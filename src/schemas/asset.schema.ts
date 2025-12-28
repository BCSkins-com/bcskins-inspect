import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { StickerKeychain } from 'src/modules/inspect/interfaces/schema.interface';

export type AssetDocument = Asset & Document;

@Schema({ 
  timestamps: true,
  collection: 'inspect_assets'
})
export class Asset {
  @Prop({ required: true, index: true, unique: true })
  uniqueId: string;

  @Prop({ required: true, type: Number, index: true })
  assetId: number;

  @Prop({ required: true, type: Number, index: true })
  ms: number;

  @Prop({ required: true })
  d: string;

  @Prop({ type: Number, index: true })
  paintSeed: number;

  @Prop({ type: Number, index: true })
  paintIndex: number;

  @Prop({ type: Number, index: true })
  paintWear: number;

  @Prop({ type: Number })
  quality: number;

  @Prop({ maxlength: 64 })
  customName: string;

  @Prop({ type: Number, index: true })
  defIndex: number;

  @Prop({ type: Number })
  origin: number;

  @Prop({ type: Number, index: true })
  rarity: number;

  @Prop({ type: Number })
  questId: number;

  @Prop({ type: Number })
  reason: number;

  @Prop({ type: Number })
  musicIndex: number;

  @Prop({ type: Number })
  entIndex: number;

  @Prop({ type: [Object] })
  stickers: StickerKeychain[];

  @Prop({ type: [Object] })
  keychains: StickerKeychain[];

  @Prop({ type: Number })
  killeaterScoreType: number;

  @Prop({ type: Number })
  killeaterValue: number;

  @Prop({ type: Number })
  petIndex: number;

  @Prop({ type: Number, required: true })
  inventory: number;

  @Prop({ type: Number })
  dropReason: number;

  // Virtual getters
  get isStattrak(): boolean {
    return this.killeaterValue !== null && this.killeaterValue !== undefined;
  }

  get isSouvenir(): boolean {
    return this.quality === 12;
  }
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

// Add compound indexes
AssetSchema.index({ ms: 1, assetId: 1, d: 1, stickers: 1 }, { unique: true });
AssetSchema.index({ paintIndex: 1, defIndex: 1, paintWear: 1, quality: 1, killeaterValue: 1 });
AssetSchema.index({ paintWear: 1, paintIndex: 1, defIndex: 1 });

