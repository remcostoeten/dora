import { Preset } from '../types';
import { userPreset } from './definitions/user-preset';
import { productPreset } from './definitions/product-preset';
import { blogPreset } from './definitions/blog-preset';
import { orderPreset } from './definitions/order-preset';
import { companyPreset } from './definitions/company-preset';

export const presets: Preset[] = [
  userPreset,
  productPreset,
  blogPreset,
  orderPreset,
  companyPreset
];

export const getPreset = (name: string): Preset | undefined => {
  return presets.find(preset => preset.name === name);
};

export const getPresetNames = (): string[] => {
  return presets.map(preset => preset.name);
};