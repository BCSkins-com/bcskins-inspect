import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InspectModule } from './inspect/inspect.module';
import { ScheduleModule } from '@nestjs/schedule';
import 'dotenv/config';

@Module({
    imports: [
        MongooseModule.forRoot(process.env.DATABASE_URL, {
            // MongoDB connection options
        }),
        InspectModule,
        ScheduleModule.forRoot(),
    ],
})
export class MainModule implements OnModuleInit {
    private readonly logger = new Logger(MainModule.name);

    constructor() {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not defined');
        }
    }

    onModuleInit() {
        this.logger.log('MongoDB connected successfully');
    }
}
