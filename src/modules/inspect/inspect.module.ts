import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InspectService } from './inspect.service';
import { InspectController } from './inspect.controller';
import { ParseService } from './parse.service';
import { Asset, AssetSchema } from 'src/schemas/asset.schema';
import { History, HistorySchema } from 'src/schemas/history.schema';
import { FormatService } from './format.service';
import { PricempireModule } from '../pricempire/pricempire.module';
import { HttpModule } from '@nestjs/axios';
import { QueueService } from './queue.service';
import { WorkerManagerService } from './worker/worker-manager.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Asset.name, schema: AssetSchema },
            { name: History.name, schema: HistorySchema },
        ]),
        PricempireModule,
        HttpModule,
    ],
    providers: [InspectService, ParseService, FormatService, QueueService, WorkerManagerService],
    controllers: [InspectController],
})
export class InspectModule { }
