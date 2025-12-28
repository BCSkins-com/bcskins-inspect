import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { StickerKeychain } from 'src/modules/inspect/interfaces/schema.interface';

export type HistoryDocument = History & Document;

export enum HistoryType {
  // Trading Events
  TRADE = 1,
  TRADE_BOT = 2,
  TRADE_CANCELLED = 3,

  // Market Events
  MARKET_LISTING = 4,
  MARKET_BUY = 5,
  MARKET_RELISTING = 6,
  MARKET_CANCELLED = 7,

  // Sticker Events
  STICKER_APPLY = 8,
  STICKER_REMOVE = 9,
  STICKER_CHANGE = 10,
  STICKER_SCRAPE = 11,

  // Item Source Events
  UNBOXED = 12,
  CRAFTED = 13,
  TRADED_UP = 14,
  PURCHASED_INGAME = 15,
  DROPPED = 16,

  // Name Tag Events
  NAMETAG_ADDED = 17,
  NAMETAG_REMOVED = 18,

  // Keychain Events
  KEYCHAIN_ADDED = 19,
  KEYCHAIN_REMOVED = 20,
  KEYCHAIN_CHANGED = 21,

  // Special Events
  STORAGE_UNIT_STORED = 22,
  STORAGE_UNIT_RETRIEVED = 23,
  GIFT_RECEIVED = 24,
  GIFT_SENT = 25,

  // Contract Events
  CONTRACT_LISTED = 26,
  CONTRACT_COMPLETED = 27,
  CONTRACT_CANCELLED = 28,

  // Other
  UNKNOWN = 99
}

@Schema({ 
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'inspect_history'
})
export class History {
  @Prop({ required: true, index: true })
  uniqueId: string;

  @Prop({ required: true, type: Number, index: true })
  assetId: number;

  @Prop({ type: Number, index: true })
  prevAssetId: number;

  @Prop({ required: true, type: Number, enum: HistoryType, index: true })
  type: HistoryType;

  @Prop({ required: true, type: Number, index: true })
  owner: number;

  @Prop({ type: Number, index: true })
  prevOwner: number;

  @Prop({ maxlength: 64 })
  d: string;

  @Prop({ type: [Object] })
  stickers: StickerKeychain[];

  @Prop({ type: [Object] })
  prevStickers: StickerKeychain[];

  @Prop({ type: [Object] })
  keychains: StickerKeychain[];

  @Prop({ type: [Object] })
  prevKeychains: StickerKeychain[];
}

export const HistorySchema = SchemaFactory.createForClass(History);

// Add compound indexes
HistorySchema.index({ uniqueId: 1, assetId: 1 }, { unique: true });
HistorySchema.index({ assetId: 1, prevAssetId: 1 });

