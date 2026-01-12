import { parentPort, workerData } from 'worker_threads';
import { Bot, BotStatus, BotError, PERMANENT_ERRORS } from '../bot.class';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';

/**
 * Worker thread implementation for managing a batch of bots
 */
class BotWorker {
    private readonly logger = new Logger('BotWorker');
    private bots: Map<string, Bot> = new Map();
    private accounts: string[] = [];
    private throttledAccounts: Map<string, number> = new Map();
    private failedAccounts: Map<string, { error: string; timestamp: number }> = new Map();
    private readonly THROTTLE_COOLDOWN = 30 * 60 * 1000; // 30 minutes
    private readonly MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
    private readonly HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'); // 1 minute
    private readonly workerId: number;

    constructor() {
        this.workerId = workerData.workerId;
        this.accounts = workerData.accounts || [];

        this.logger.log(`Worker ${this.workerId} initialized with ${this.accounts.length} accounts`);

        this.setupCommunication();
        this.initializeBots();

        // Set up periodic stats reporting
        this.setupPeriodicStatsReporting();
        
        // Set up periodic health checks for bot reconnection
        this.setupHealthCheck();
    }

    private setupCommunication() {
        if (!parentPort) {
            this.logger.error('No parent port available for worker communication');
            return;
        }

        parentPort.on('message', (message) => {
            switch (message.type) {
                case 'inspectItem':
                    this.handleInspectRequest(message);
                    break;
                case 'getStats':
                    this.sendStats();
                    break;
                case 'shutdown':
                    this.shutdown();
                    break;
                case 'reconnectBot':
                    this.handleReconnectRequest(message);
                    break;
                case 'reconnectAllBots':
                    this.handleReconnectAllRequest();
                    break;
                case 'healthCheck':
                    this.performHealthCheck();
                    break;
                default:
                    this.logger.warn(`Unknown message type: ${message.type}`);
            }
        });
    }
    
    /**
     * Handle request to reconnect a specific bot
     */
    private async handleReconnectRequest(message: { username: string }) {
        const { username } = message;
        const bot = this.bots.get(username);
        
        if (!bot) {
            this.logger.warn(`Cannot reconnect bot ${username}: not found`);
            return;
        }
        
        try {
            this.logger.log(`Manual reconnection requested for bot ${username}`);
            await bot.forceReconnect();
        } catch (error) {
            this.logger.error(`Failed to reconnect bot ${username}: ${error.message}`);
        }
    }
    
    /**
     * Handle request to reconnect all failed/disconnected bots
     */
    private async handleReconnectAllRequest() {
        this.logger.log(`Manual reconnection of all failed bots requested for worker ${this.workerId}`);
        
        for (const [username, bot] of this.bots.entries()) {
            if (bot.isError() || bot.isDisconnected()) {
                if (bot.canReconnect()) {
                    try {
                        this.logger.log(`Forcing reconnection for bot ${username}`);
                        await bot.forceReconnect();
                    } catch (error) {
                        this.logger.error(`Failed to reconnect bot ${username}: ${error.message}`);
                    }
                }
            }
        }
        
        this.sendStats();
    }

    private async initializeBots() {
        this.logger.log(`Worker ${this.workerId} initializing ${this.accounts.length} bots`);
        const sessionPath = process.env.SESSION_PATH || './sessions';

        // Ensure session directory exists
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
            this.logger.debug(`Created session directory: ${sessionPath}`);
        }

        // Track initialization progress for logging
        let successCount = 0;
        let failureCount = 0;

        for (const account of this.accounts) {
            // Split only on first colon to handle passwords containing colons
            const colonIndex = account.indexOf(':');
            const username = account.substring(0, colonIndex);
            const password = account.substring(colonIndex + 1);

            // Skip throttled accounts
            const throttleExpiry = this.throttledAccounts.get(username);
            if (throttleExpiry && Date.now() < throttleExpiry) {
                this.logger.warn(`Account ${username} is throttled. Skipping initialization.`);
                continue;
            }

            let retryCount = 0;
            let initialized = false;

            while (retryCount < this.MAX_RETRIES && !initialized) {
                try {
                    const bot = new Bot({
                        username,
                        password,
                        proxyUrl: process.env.PROXY_URL,
                        debug: process.env.DEBUG === 'true',
                        sessionPath,
                        blacklistPath: process.env.BLACKLIST_PATH || './blacklist.txt',
                        inspectTimeout: parseInt(process.env.INSPECT_TIMEOUT || '10000'),
                        cooldownTime: parseInt(process.env.BOT_COOLDOWN_TIME || '30000'),
                        // Reconnection settings from env
                        maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10'),
                        baseReconnectDelay: parseInt(process.env.BASE_RECONNECT_DELAY || '30000'),
                        maxReconnectDelay: parseInt(process.env.MAX_RECONNECT_DELAY || '600000'),
                    });

                    // Forward bot events to parent process
                    bot.on('inspectResult', (response) => this.handleInspectResult(username, response));
                    bot.on('error', (error) => {
                        this.logger.error(`Bot ${username} error: ${error}`);
                        this.sendToParent({
                            type: 'botError',
                            workerId: this.workerId,
                            username,
                            error: error.toString(),
                            reconnectStatus: bot.getReconnectStatus()
                        });
                    });
                    
                    // Handle reconnection events
                    bot.on('reconnectScheduled', (data) => {
                        this.logger.log(`Bot ${username} reconnection scheduled: attempt ${data.attempt}/${data.maxAttempts} in ${Math.round(data.delayMs / 1000)}s`);
                        this.sendToParent({
                            type: 'botReconnectScheduled',
                            workerId: this.workerId,
                            username,
                            ...data
                        });
                    });
                    
                    bot.on('reconnecting', (data) => {
                        this.logger.log(`Bot ${username} attempting reconnection (attempt ${data.attempt})`);
                        this.sendToParent({
                            type: 'botReconnecting',
                            workerId: this.workerId,
                            username,
                            attempt: data.attempt
                        });
                    });
                    
                    bot.on('reconnected', () => {
                        this.logger.log(`Bot ${username} successfully reconnected`);
                        this.failedAccounts.delete(username);
                        this.sendToParent({
                            type: 'botReconnected',
                            workerId: this.workerId,
                            username,
                            status: bot.isReady() ? 'ready' : 'initializing'
                        });
                        // Send updated stats
                        this.sendStats();
                    });
                    
                    bot.on('maxReconnectAttemptsReached', () => {
                        this.logger.error(`Bot ${username} has exhausted all reconnection attempts`);
                        this.failedAccounts.set(username, { 
                            error: 'MAX_RECONNECT_ATTEMPTS', 
                            timestamp: Date.now() 
                        });
                        this.sendToParent({
                            type: 'botPermanentlyFailed',
                            workerId: this.workerId,
                            username,
                            reason: 'MAX_RECONNECT_ATTEMPTS'
                        });
                    });
                    
                    bot.on('disconnected', () => {
                        this.logger.warn(`Bot ${username} disconnected`);
                        this.sendToParent({
                            type: 'botStatusChange',
                            workerId: this.workerId,
                            username,
                            status: 'disconnected'
                        });
                        this.sendStats();
                    });

                    await bot.initialize();
                    this.bots.set(username, bot);
                    initialized = true;
                    successCount++;

                    // Clear throttle status if successful
                    this.throttledAccounts.delete(username);

                    // Notify parent about successful initialization
                    this.sendToParent({
                        type: 'botInitialized',
                        workerId: this.workerId,
                        username,
                        status: bot.isReady() ? 'ready' : 'initializing'
                    });

                    this.logger.debug(`Bot ${username} initialized successfully with status: ${bot.isReady() ? 'ready' : 'initializing'}`);
                } catch (error) {
                    failureCount++;
                    if (error.message === 'ACCOUNT_DISABLED') {
                        this.logger.error(`Account ${username} is disabled. Blacklisting...`);
                        this.accounts = this.accounts.filter(acc => !acc.startsWith(username));
                        break;
                    } else if (error.message === 'LOGIN_THROTTLED') {
                        this.logger.warn(`Account ${username} is throttled. Adding to cooldown.`);
                        this.throttledAccounts.set(username, Date.now() + this.THROTTLE_COOLDOWN);
                        break;
                    } else {
                        this.logger.error(`Failed to initialize bot ${username}: ${error.message}`);
                    }
                    retryCount++;
                }
            }
        }

        // Send comprehensive stats after all bots are initialized
        this.logger.log(`Worker ${this.workerId} finished initializing ${this.bots.size} bots (${successCount} success, ${failureCount} failures)`);

        // Send complete stats to parent
        this.sendStats();
    }

    private setupPeriodicStatsReporting() {
        // Send stats every 3 seconds to balance between real-time updates and overhead
        const STATS_UPDATE_INTERVAL = parseInt(process.env.STATS_UPDATE_INTERVAL || '3000');
        setInterval(() => {
            this.sendStats();
        }, STATS_UPDATE_INTERVAL);
    }
    
    /**
     * Set up periodic health check to monitor and recover failed bots
     */
    private setupHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.HEALTH_CHECK_INTERVAL);
        
        // Also run initial health check after bots are initialized (delay to allow initialization to complete)
        setTimeout(() => {
            this.performHealthCheck();
        }, 30000); // 30 seconds after startup
    }
    
    /**
     * Perform health check on all bots and attempt to recover failed ones
     */
    private async performHealthCheck() {
        const errorBots: string[] = [];
        const disconnectedBots: string[] = [];
        const reconnectingBots: string[] = [];
        
        // Check status of all bots
        for (const [username, bot] of this.bots.entries()) {
            if (bot.isError()) {
                errorBots.push(username);
            } else if (bot.isDisconnected()) {
                disconnectedBots.push(username);
            }
            
            const reconnectStatus = bot.getReconnectStatus();
            if (reconnectStatus.hasScheduledReconnect) {
                reconnectingBots.push(username);
            }
        }
        
        // Log health status
        if (errorBots.length > 0 || disconnectedBots.length > 0) {
            this.logger.warn(`Worker ${this.workerId} health check: ${errorBots.length} error, ${disconnectedBots.length} disconnected, ${reconnectingBots.length} reconnecting`);
        }
        
        // Try to recover failed accounts that aren't currently initializing
        for (const username of [...errorBots, ...disconnectedBots]) {
            const bot = this.bots.get(username);
            if (!bot) continue;
            
            const reconnectStatus = bot.getReconnectStatus();
            
            // Skip if bot is already trying to reconnect
            if (reconnectStatus.hasScheduledReconnect) {
                continue;
            }
            
            // Skip if bot has permanently failed
            if (reconnectStatus.isPermanentlyFailed) {
                continue;
            }
            
            // Check if throttled
            const throttleExpiry = this.throttledAccounts.get(username);
            if (throttleExpiry && Date.now() < throttleExpiry) {
                continue;
            }
            
            // Schedule reconnection if bot can reconnect
            if (bot.canReconnect()) {
                this.logger.log(`Health check: scheduling reconnection for bot ${username}`);
                bot.scheduleReconnect();
            }
        }
        
        // Attempt to initialize any accounts that failed during startup but aren't in bots map
        await this.retryFailedAccountInitialization();
        
        // Send updated stats after health check
        this.sendStats();
    }
    
    /**
     * Retry initialization for accounts that failed during initial startup
     */
    private async retryFailedAccountInitialization() {
        const sessionPath = process.env.SESSION_PATH || './sessions';
        
        for (const account of this.accounts) {
            const colonIndex = account.indexOf(':');
            const username = account.substring(0, colonIndex);
            const password = account.substring(colonIndex + 1);
            
            // Skip if bot already exists and is functioning
            const existingBot = this.bots.get(username);
            if (existingBot && !existingBot.isError() && !existingBot.isDisconnected()) {
                continue;
            }
            
            // Skip if throttled
            const throttleExpiry = this.throttledAccounts.get(username);
            if (throttleExpiry && Date.now() < throttleExpiry) {
                continue;
            }
            
            // Skip if permanently failed
            const failedInfo = this.failedAccounts.get(username);
            if (failedInfo) {
                // Allow retry after 30 minutes for non-permanent failures
                if (Date.now() - failedInfo.timestamp < 30 * 60 * 1000) {
                    continue;
                }
                // Remove from failed accounts to allow retry
                this.failedAccounts.delete(username);
            }
            
            // If bot doesn't exist but should, try to create it
            if (!existingBot) {
                this.logger.log(`Health check: attempting to initialize missing bot ${username}`);
                await this.initializeSingleBot(username, password, sessionPath);
            }
        }
    }
    
    /**
     * Initialize a single bot (used for retry/recovery)
     */
    private async initializeSingleBot(username: string, password: string, sessionPath: string): Promise<boolean> {
        try {
            const bot = new Bot({
                username,
                password,
                proxyUrl: process.env.PROXY_URL,
                debug: process.env.DEBUG === 'true',
                sessionPath,
                blacklistPath: process.env.BLACKLIST_PATH || './blacklist.txt',
                inspectTimeout: parseInt(process.env.INSPECT_TIMEOUT || '10000'),
                cooldownTime: parseInt(process.env.BOT_COOLDOWN_TIME || '30000'),
                maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10'),
                baseReconnectDelay: parseInt(process.env.BASE_RECONNECT_DELAY || '30000'),
                maxReconnectDelay: parseInt(process.env.MAX_RECONNECT_DELAY || '600000'),
            });

            // Set up event handlers
            this.setupBotEventHandlers(bot, username);

            await bot.initialize();
            this.bots.set(username, bot);
            
            // Clear any failure tracking
            this.throttledAccounts.delete(username);
            this.failedAccounts.delete(username);

            this.sendToParent({
                type: 'botInitialized',
                workerId: this.workerId,
                username,
                status: bot.isReady() ? 'ready' : 'initializing'
            });

            this.logger.log(`Bot ${username} initialized successfully during health check`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to initialize bot ${username} during health check: ${error.message}`);
            
            if (error.message === 'LOGIN_THROTTLED') {
                this.throttledAccounts.set(username, Date.now() + this.THROTTLE_COOLDOWN);
            }
            
            return false;
        }
    }
    
    /**
     * Set up event handlers for a bot (extracted for reuse)
     */
    private setupBotEventHandlers(bot: Bot, username: string) {
        bot.on('inspectResult', (response) => this.handleInspectResult(username, response));
        
        bot.on('error', (error) => {
            this.logger.error(`Bot ${username} error: ${error}`);
            this.sendToParent({
                type: 'botError',
                workerId: this.workerId,
                username,
                error: error.toString(),
                reconnectStatus: bot.getReconnectStatus()
            });
        });
        
        bot.on('reconnectScheduled', (data) => {
            this.logger.log(`Bot ${username} reconnection scheduled: attempt ${data.attempt}/${data.maxAttempts} in ${Math.round(data.delayMs / 1000)}s`);
            this.sendToParent({
                type: 'botReconnectScheduled',
                workerId: this.workerId,
                username,
                ...data
            });
        });
        
        bot.on('reconnecting', (data) => {
            this.logger.log(`Bot ${username} attempting reconnection (attempt ${data.attempt})`);
            this.sendToParent({
                type: 'botReconnecting',
                workerId: this.workerId,
                username,
                attempt: data.attempt
            });
        });
        
        bot.on('reconnected', () => {
            this.logger.log(`Bot ${username} successfully reconnected`);
            this.failedAccounts.delete(username);
            this.sendToParent({
                type: 'botReconnected',
                workerId: this.workerId,
                username,
                status: bot.isReady() ? 'ready' : 'initializing'
            });
            this.sendStats();
        });
        
        bot.on('maxReconnectAttemptsReached', () => {
            this.logger.error(`Bot ${username} has exhausted all reconnection attempts`);
            this.failedAccounts.set(username, { 
                error: 'MAX_RECONNECT_ATTEMPTS', 
                timestamp: Date.now() 
            });
            this.sendToParent({
                type: 'botPermanentlyFailed',
                workerId: this.workerId,
                username,
                reason: 'MAX_RECONNECT_ATTEMPTS'
            });
        });
        
        bot.on('disconnected', () => {
            this.logger.warn(`Bot ${username} disconnected`);
            this.sendToParent({
                type: 'botStatusChange',
                workerId: this.workerId,
                username,
                status: 'disconnected'
            });
            this.sendStats();
        });
    }

    private async handleInspectRequest(message: any) {
        const { s, a, d, m, requestId } = message;

        try {
            const bot = await this.getAvailableBot();
            if (!bot) {
                this.sendToParent({
                    type: 'inspectError',
                    requestId,
                    assetId: a,
                    error: 'No bots are ready in this worker'
                });
                return;
            }

            // Notify parent that a bot is now busy (real-time status update)
            this.sendToParent({
                type: 'botStatusChange',
                workerId: this.workerId,
                username: this.getBotUsername(bot),
                status: 'busy',
                assetId: a
            });

            // Send updated stats immediately after status change
            this.sendStats();

            await bot.inspectItem(m !== '0' && m ? m : s, a, d);
        } catch (error) {
            this.sendToParent({
                type: 'inspectError',
                requestId,
                assetId: a,
                error: error.message
            });
        }
    }

    private handleInspectResult(username: string, response: any) {
        const bot = this.bots.get(username);
        if (!bot) return;

        // Increment bot stats
        bot.incrementSuccessCount();
        bot.incrementInspectCount();

        // Notify parent that bot is now ready again (real-time status update)
        this.sendToParent({
            type: 'botStatusChange',
            workerId: this.workerId,
            username,
            status: 'ready',
            assetId: response.itemid?.toString()
        });

        // Send result back to parent
        this.sendToParent({
            type: 'inspectResult',
            workerId: this.workerId,
            assetId: response.itemid?.toString(),
            result: response
        });

        // Send updated stats immediately after status change
        this.sendStats();
    }

    private getBotUsername(bot: Bot): string {
        // Find the username for a bot instance
        for (const [username, botInstance] of this.bots.entries()) {
            if (botInstance === bot) {
                return username;
            }
        }
        return 'unknown';
    }

    private async getAvailableBot(): Promise<Bot | null> {
        const readyBots = Array.from(this.bots.entries())
            .filter(([_, bot]) => bot.isReady());

        if (readyBots.length === 0) {
            return null;
        }

        // Simple round-robin selection
        const randomIndex = Math.floor(Math.random() * readyBots.length);
        return readyBots[randomIndex][1];
    }

    private sendStats() {
        const readyBots = Array.from(this.bots.values()).filter(bot => bot.isReady()).length;
        const busyBots = Array.from(this.bots.values()).filter(bot => bot.isBusy()).length;
        const cooldownBots = Array.from(this.bots.values()).filter(bot => bot.isCooldown()).length;
        const errorBots = Array.from(this.bots.values()).filter(bot => bot.isError()).length;
        const disconnectedBots = Array.from(this.bots.values()).filter(bot => bot.isDisconnected()).length;
        const totalBots = this.bots.size;
        
        // Count bots currently attempting to reconnect
        const reconnectingBots = Array.from(this.bots.values()).filter(bot => {
            const status = bot.getReconnectStatus();
            return status.hasScheduledReconnect;
        }).length;

        const botDetails = Array.from(this.bots.entries()).map(([username, bot]) => {
            const reconnectStatus = bot.getReconnectStatus();
            return {
                username: username.substring(0, 10), // Truncate username
                status: bot.isReady() ? 'ready' :
                    bot.isBusy() ? 'busy' :
                        bot.isCooldown() ? 'cooldown' :
                            bot.isDisconnected() ? 'disconnected' : 'error',
                inspectCount: bot.getInspectCount() || 0,
                successCount: bot.getSuccessCount() || 0,
                failureCount: bot.getFailureCount() || 0,
                lastInspectTime: bot.getLastInspectTime() || null,
                // Reconnection info
                reconnecting: reconnectStatus.hasScheduledReconnect,
                reconnectAttempts: reconnectStatus.reconnectAttempts,
                canReconnect: reconnectStatus.canReconnect,
                isPermanentlyFailed: reconnectStatus.isPermanentlyFailed,
                lastError: reconnectStatus.lastError
            };
        });

        // Log stats for debugging
        // this.logger.debug(`Worker ${this.workerId} stats: ready=${readyBots}, busy=${busyBots}, cooldown=${cooldownBots}, error=${errorBots}, disconnected=${disconnectedBots}, total=${totalBots}`);

        this.sendToParent({
            type: 'stats',
            workerId: this.workerId,
            stats: {
                readyBots,
                busyBots,
                cooldownBots,
                errorBots,
                disconnectedBots,
                reconnectingBots,
                totalBots,
                botDetails,
                // Include counts of tracked issues
                throttledAccounts: this.throttledAccounts.size,
                failedAccounts: this.failedAccounts.size
            }
        });
    }

    private async shutdown() {
        this.logger.log(`Worker ${this.workerId} shutting down...`);

        // Destroy all bots
        const destroyPromises = Array.from(this.bots.values()).map(bot => bot.destroy());
        await Promise.allSettled(destroyPromises);

        this.logger.log(`Worker ${this.workerId} shut down ${this.bots.size} bots`);

        // Notify parent that we're done
        this.sendToParent({
            type: 'shutdown',
            workerId: this.workerId,
            status: 'completed'
        });

        // Exit the worker thread
        if (parentPort) {
            parentPort.close();
        }
        process.exit(0);
    }

    private sendToParent(message: any) {
        if (parentPort) {
            parentPort.postMessage(message);
        }
    }
}

process.on('uncaughtException', err => {
    // console.log(`Uncaught Exception: ${err.message}`)
    // process.exit(1)
})
process.on('unhandledRejection', (reason, promise) => {
    // console.log('Unhandled rejection at ', promise, `reason: ${reason.message}`)
    // process.exit(1)
})


// Start the worker
new BotWorker();
