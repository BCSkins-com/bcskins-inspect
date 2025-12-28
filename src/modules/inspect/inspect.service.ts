import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParseService } from './parse.service';
import { Asset, AssetDocument } from 'src/schemas/asset.schema';
import { History, HistoryDocument, HistoryType } from 'src/schemas/history.schema';
import { FormatService } from './format.service';
import { InspectDto } from './inspect.dto';
import { createHash } from 'crypto';
import { QueueService } from './queue.service';
import { WorkerManagerService } from './worker/worker-manager.service';

@Injectable()
export class InspectService implements OnModuleInit {
    private readonly logger = new Logger(InspectService.name);
    private startTime: number = Date.now();
    private readonly QUEUE_TIMEOUT = parseInt(process.env.QUEUE_TIMEOUT || '10000'); // 10 seconds timeout
    private readonly MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100');

    private inspects: Map<string, {
        ms: string;
        d: string;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
        timeoutId: NodeJS.Timeout;
        startTime?: number;
        retryCount?: number;
        inspectUrl?: { s: string; a: string; d: string; m: string };
        priority: string;
    }> = new Map();

    private currentRequests = 0;
    private success = 0;
    private cached = 0;
    private failed = 0;
    private timeouts = 0;

    constructor(
        private parseService: ParseService,
        private formatService: FormatService,
        @InjectModel(Asset.name)
        private assetModel: Model<AssetDocument>,
        @InjectModel(History.name)
        private historyModel: Model<HistoryDocument>,
        private readonly queueService: QueueService,
        private readonly workerManagerService: WorkerManagerService,
    ) { }

    async onModuleInit() {
        this.logger.debug('Starting Inspect Module...');

        if (process.env.WORKER_ENABLED === 'true') {
            this.logger.log('Worker mode enabled. Bot initialization handled by Worker Manager Service.');
            this.logger.log('Each worker thread will handle up to 50 bots for optimal performance.');
        } else {
            this.logger.warn('Worker mode is disabled. To enable multi-threading, set WORKER_ENABLED=true');
            this.logger.warn('Reverting to single-threaded legacy mode.');

            // Let's still use the worker manager's accounts
            await this.workerManagerService.onModuleInit();
        }
    }

    public stats() {
        const stats = this.workerManagerService.getStats();

        // Calculate uptime
        const uptime = Date.now() - this.startTime;
        const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
        const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((uptime % (60 * 1000)) / 1000);

        // Get response time stats and metrics from the correct path
        const responseTimeStats = stats.responseTimeStats;
        const metrics = stats.metrics;

        // Get queue metrics including priority information
        const queueMetrics = this.queueService.getQueueMetrics();
        const priorityCounts = {
            high: 0,
            normal: 0,
            low: 0
        };

        queueMetrics.items.forEach(item => {
            priorityCounts[item.priority]++;
        });

        // Return a clean, well-organized stats structure
        return {
            uptime: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            service: {
                status: stats.readyBots > 0 ? 'healthy' : 'initializing',
                version: process.env.npm_package_version || 'unknown',
                bots: {
                    total: stats.totalBots,
                    ready: stats.readyBots,
                    busy: stats.busyBots,
                    error: stats.errorBots,
                    cooldown: stats.cooldownBots,
                    disconnected: stats.disconnectedBots,
                    availabilityPercentage: stats.botAvailabilityPercentage.toFixed(2) + '%',
                },
                queue: {
                    current: this.inspects.size,
                    max: this.MAX_QUEUE_SIZE,
                    priorities: priorityCounts
                },
            },
            inspections: {
                total: metrics.success + metrics.failed + metrics.timeouts,
                success: metrics.success,
                cached: metrics.cached,
                failed: metrics.failed,
                timeouts: metrics.timeouts,
                activeCount: stats.activeInspections,
                successRate: metrics.success > 0
                    ? (metrics.success / (metrics.success + metrics.failed + metrics.timeouts) * 100).toFixed(2) + '%'
                    : '0%',
                retries: {
                    total: metrics.retriedInspections || 0,
                    successfulAfterRetry: metrics.successAfterRetry || 0
                }
            },
            performance: {
                allTime: responseTimeStats.allTime,
                last5Minutes: responseTimeStats.recent
            },
            // Include detailed info for administrators
            details: {
                botStatus: metrics.botDetails || [],
                activeInspections: metrics.activeInspectionDetails || []
            }
        };
    }

    public async inspectItem(query: InspectDto) {
        this.currentRequests++;

        const { s, a, d, m } = this.parseService.parse(query);

        // First check if we have cached data before checking bot availability
        if (!query.refresh) {
            const cachedAsset = await this.checkCache(a, d);
            if (cachedAsset) {
                this.cached++;
                this.workerManagerService.incrementCached();
                return cachedAsset;
            }
        }

        if (this.queueService.isFull()) {
            throw new HttpException(
                `Queue is full (${this.queueService.size()}/${this.MAX_QUEUE_SIZE}), please try again later`,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // If reply is false, acknowledge receipt and process in background
        if (query.reply === false) {
            // Start the inspection process in the background
            this.processInspectionInBackground(s, a, d, m, query.lowPriority);

            // Return immediate acknowledgment
            return {
                success: true,
                message: 'Inspection request received and being processed in background',
                assetId: a
            };
        }

        // Normal flow - wait for inspection to complete
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.timeouts++;
                reject(new HttpException('Inspection request timed out', HttpStatus.GATEWAY_TIMEOUT));
            }, this.QUEUE_TIMEOUT);

            // Add to queue before making the request
            this.queueService.add(a, {
                ms: m !== '0' && m ? m : s,
                d,
                resolve,
                reject,
                timeoutId,
                retryCount: 0,
                inspectUrl: { s, a, d, m },
                priority: query.lowPriority ? 'low' : 'normal'
            });

            // Try using the worker manager
            this.workerManagerService.inspectItem(s, a, d, m, query.lowPriority ? 'low' : 'normal')
                .then(async (response) => {
                    clearTimeout(timeoutId);
                    this.success++;

                    try {
                        const formattedResponse = await this.handleInspectResult(response, {
                            ms: m !== '0' && m ? m : s,
                            d,
                        });
                        // Remove from queue after successful processing
                        this.queueService.remove(a);
                        this.logger.debug(`Successfully processed and removed item ${a} from queue`);
                        resolve(formattedResponse);
                    } catch (error) {
                        console.log(response);
                        this.logger.error(`Error handling inspect result: ${error.message}`);
                        this.failed++;
                        // Ensure we remove the item from queue on error too
                        this.queueService.remove(a);
                        reject(new HttpException('Error processing inspection result', HttpStatus.INTERNAL_SERVER_ERROR));
                    }
                })
                .catch(error => {
                    this.logger.error(`Worker inspection error for asset ${a}: ${error.message}`);
                    this.failed++;
                    clearTimeout(timeoutId);
                    this.queueService.remove(a);
                    reject(new HttpException(
                        error.message || 'Inspection failed',
                        HttpStatus.GATEWAY_TIMEOUT
                    ));
                });
        });
    }

    /**
     * Process an inspection request in the background without waiting for the result
     */
    private async processInspectionInBackground(s: string, a: string, d: string, m: string, lowPriority?: boolean): Promise<void> {
        try {
            // Add to queue with dummy resolve/reject handlers
            this.queueService.add(a, {
                ms: m !== '0' && m ? m : s,
                d,
                resolve: () => {
                    this.logger.debug(`Background inspection for item ${a} completed successfully`);
                    this.success++;
                },
                reject: (error) => {
                    this.logger.error(`Background inspection for item ${a} failed: ${error.message}`);
                    this.failed++;
                },
                timeoutId: setTimeout(() => {
                    this.logger.warn(`Background inspection for item ${a} timed out`);
                    this.timeouts++;
                    this.queueService.remove(a);
                }, this.QUEUE_TIMEOUT),
                retryCount: 0,
                inspectUrl: { s, a, d, m },
                priority: lowPriority ? 'low' : 'normal'
            });

            // Process with the worker manager
            this.workerManagerService.inspectItem(s, a, d, m, lowPriority ? 'low' : 'normal')
                .then(async (response) => {
                    try {
                        await this.handleInspectResult(response, {
                            ms: m !== '0' && m ? m : s,
                            d,
                        });
                        this.logger.debug(`Successfully processed background inspection for item ${a}`);
                    } catch (error) {
                        this.logger.error(`Error handling background inspection result: ${error.message}`);
                    } finally {
                        this.queueService.remove(a);
                    }
                })
                .catch(error => {
                    this.logger.error(`Background inspection error for asset ${a}: ${error.message}`);
                    this.queueService.remove(a);
                });
        } catch (error) {
            this.logger.error(`Failed to start background inspection for asset ${a}: ${error.message}`);
        }
    }

    private async handleInspectResult(response: any, inspectData: any) {
        try {
            const uniqueId = this.generateUniqueId({
                paintSeed: response.paintseed,
                paintIndex: response.paintindex === null ? 0 : response.paintindex,
                paintWear: response.paintwear === null ? 0 : response.paintwear,
                defIndex: response.defindex,
                origin: response.origin,
                rarity: response.rarity,
                questId: response.questid,
                quality: response.quality,
                dropReason: response.dropreason
            });
            // Only save history if the paintseed is present and the paintindex is not 0
            if (
                response.paintseed &&
                response.paintwear !== null &&
                response.paintindex !== null
            ) {
                const history = await this.findHistory(response);
                await this.saveHistory(response, history, inspectData, uniqueId);
            }
            const asset = await this.saveAsset(response, inspectData, uniqueId);

            if (!asset) {
                console.log(response);
                this.logger.error(`No asset found for item ${response.itemid}`);
                throw new Error(`No asset found for item ${response.itemid}`);
            }

            const formattedResponse = await this.formatService.formatResponse(asset);
            return formattedResponse;
        } catch (error) {
            this.logger.error(`Failed to handle inspect result: ${error.message}`);
            throw error;
        }
    }

    private async checkCache(assetId: string, d: string): Promise<any> {
        try {
            const assetIdNum = parseInt(assetId, 10);
            const asset = await this.assetModel.findOne({ assetId: assetIdNum }).exec();
            if (asset) {
                return this.formatService.formatResponse(asset);
            }
            return null;
        } catch (e) {
            this.logger.error(`Error checking cache: ${e.message}`);
            return null;
        }
    }

    private async findHistory(response: any) {
        return await this.assetModel.findOne({
            paintWear: response.paintwear,
            paintIndex: response.paintindex,
            defIndex: response.defindex,
            paintSeed: response.paintseed,
            origin: response.origin,
            questId: response.questid,
            rarity: response.rarity,
        }).sort({ createdAt: -1 }).exec();
    }

    private async saveHistory(response: any, history: any, inspectData: any, uniqueId: string) {
        const existing = await this.historyModel.findOne({
            assetId: parseInt(response.itemid),
        }).exec();

        if (!existing) {
            await this.historyModel.create({
                uniqueId,
                assetId: parseInt(response.itemid),
                prevAssetId: history?.assetId,
                owner: inspectData.ms,
                prevOwner: history?.ms,
                d: inspectData.d,
                stickers: response.stickers,
                keychains: response.keychains,
                prevStickers: history?.stickers,
                prevKeychains: history?.keychains,
                type: this.getHistoryType(response, history, inspectData),
            });
        }
    }

    private getHistoryType(response: any, history: any, inspectData: any): HistoryType {
        if (!history) {
            if (response.origin === 8) return HistoryType.TRADED_UP;
            if (response.origin === 4) return HistoryType.DROPPED;
            if (response.origin === 1) return HistoryType.PURCHASED_INGAME;
            if (response.origin === 2) return HistoryType.UNBOXED;
            if (response.origin === 3) return HistoryType.CRAFTED;
            return HistoryType.UNKNOWN;
        }

        if (history?.owner !== inspectData?.ms) {
            if (history?.owner?.toString().startsWith('7656')) {
                return HistoryType.TRADE;
            }
            if (history?.owner && !history?.owner?.toString().startsWith('7656')) {
                return HistoryType.MARKET_BUY;
            }
        }

        if (history?.owner && history.owner.toString().startsWith('7656') && !inspectData?.ms?.toString().startsWith('7656')) {
            return HistoryType.MARKET_LISTING;
        }

        if (history.owner === inspectData.ms) {
            const stickerChanges = this.detectStickerChanges(response.stickers, history.stickers);
            if (stickerChanges) return stickerChanges;

            const keychainChanges = this.detectKeychainChanges(response.keychains, history.keychains);
            if (keychainChanges) return keychainChanges;
        }

        return HistoryType.UNKNOWN;
    }

    private detectStickerChanges(currentStickers: any[], previousStickers: any[]): HistoryType | null {
        if (!currentStickers || !previousStickers) return null;

        if (currentStickers.length > previousStickers.length) {
            return HistoryType.STICKER_APPLY;
        }

        if (currentStickers.length < previousStickers.length) {
            return HistoryType.STICKER_REMOVE;
        }

        for (const current of currentStickers) {
            const previous = previousStickers.find(
                prev => prev.offset_x === current.offset_x &&
                    prev.offset_y === current.offset_y &&
                    prev.offset_z === current.offset_z &&
                    prev.rotation === current.rotation &&
                    prev.slot === current.slot &&
                    prev.sticker_id === current.sticker_id
            );

            if (!previous) {
                if (currentStickers.length === previousStickers.length) {
                    return HistoryType.STICKER_CHANGE;
                }
                return HistoryType.STICKER_REMOVE;
            }

            if (previous && current.wear !== previous.wear) {
                if (current.wear > previous.wear) {
                    return HistoryType.STICKER_SCRAPE;
                }
                return HistoryType.STICKER_CHANGE;
            }
        }

        return null;
    }

    private detectKeychainChanges(currentKeychains: any[], previousKeychains: any[]): HistoryType | null {
        if (!currentKeychains || !previousKeychains) return null;

        if (currentKeychains.length === 0 && previousKeychains.length > 0) {
            return HistoryType.KEYCHAIN_REMOVED;
        }
        if (currentKeychains.length > 0 && previousKeychains.length === 0) {
            return HistoryType.KEYCHAIN_ADDED;
        }
        if (JSON.stringify(currentKeychains) !== JSON.stringify(previousKeychains)) {
            return HistoryType.KEYCHAIN_CHANGED;
        }
        return null;
    }

    private async saveAsset(response: any, inspectData: any, uniqueId: string) {
        const assetData = {
            uniqueId,
            ms: inspectData.ms,
            d: inspectData.d,
            assetId: parseInt(response.itemid),
            paintSeed: response.paintseed === null ? 0 : response.paintseed,
            paintIndex: response.paintindex === null ? 0 : response.paintindex,
            paintWear: response.paintwear === null ? 0 : response.paintwear,
            customName: response.customname,
            defIndex: response.defindex,
            origin: response.origin,
            rarity: response.rarity,
            questId: response.questid,
            stickers: response.stickers,
            quality: response.quality,
            keychains: response.keychains,
            killeaterScoreType: response.killeaterscoretype,
            killeaterValue: response.killeatervalue,
            inventory: response.inventory,
            petIndex: response.petindex,
            musicIndex: response.musicindex,
            entIndex: response.entindex,
            dropReason: response.dropreason,
        };

        // Upsert by uniqueId
        await this.assetModel.findOneAndUpdate(
            { uniqueId },
            { $set: assetData },
            { upsert: true, new: true }
        ).exec();

        return await this.assetModel.findOne({ assetId: parseInt(response.itemid) }).exec();
    }

    private generateUniqueId(item: {
        paintSeed?: number;
        paintIndex?: number;
        paintWear?: number;
        defIndex?: number;
        origin?: number;
        rarity?: number;
        questId?: number;
        quality?: number;
        dropReason?: number;
    }): string {
        const values = [
            item.paintSeed || 0,
            item.paintIndex || 0,
            item.paintWear || 0,
            item.defIndex || 0,
        ];
        const stringToHash = values.join('-');
        return createHash('sha1').update(stringToHash).digest('hex').substring(0, 8);
    }
}
