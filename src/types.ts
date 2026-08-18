export type ActiveTool = 
  | 'nid'
  | 'bg_remover'
  | 'joint_photo'
  | 'print_sheet'
  | 'job_resizer'
  | 'quick_doc';

export type PaperSize = '4R' | 'A4' | '3R' | 'Letter';

export interface PhotoPreset {
  id: string;
  nameBn: string;
  nameEn: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
  description: string;
}

export const PHOTO_PRESETS: Record<string, PhotoPreset> = {
  PASSPORT_BD: {
    id: 'PASSPORT_BD',
    nameBn: 'বাংলাদেশ পাসপোর্ট সাইজ',
    nameEn: 'BD Passport (40x50 mm)',
    widthMm: 40,
    heightMm: 50,
    aspectRatio: 40 / 50,
    description: 'বাংলাদেশ স্ট্যান্ডার্ড পাসপোর্ট সাইজ (৪৫x৫৫ মিমি বা ৪০x৫০ মিমি)',
  },
  PASSPORT_INTL: {
    id: 'PASSPORT_INTL',
    nameBn: 'আন্তর্জাতিক পাসপোর্ট (35x45 mm)',
    nameEn: 'International Passport',
    widthMm: 35,
    heightMm: 45,
    aspectRatio: 35 / 45,
    description: 'ইন্ডিয়া, ইউরোপ, দুবাই ভিসা ও আন্তর্জাতিক পাসপোর্ট',
  },
  STAMP: {
    id: 'STAMP',
    nameBn: 'স্ট্যাম্প সাইজ (20x25 mm)',
    nameEn: 'Stamp Size',
    widthMm: 20,
    heightMm: 25,
    aspectRatio: 20 / 25,
    description: 'স্কুল, কলেজ ও সরকারি ফরমের জন্য স্ট্যাম্প সাইজ',
  },
  JOINT_PASSPORT: {
    id: 'JOINT_PASSPORT',
    nameBn: 'যৌথ পাসপোর্ট (50x40 mm)',
    nameEn: 'Joint Couple Passport',
    widthMm: 50,
    heightMm: 40,
    aspectRatio: 50 / 40,
    description: 'কাবিননামা, হজ্ব ও যৌথ অ্যাকাউন্টের ছবি',
  },
  JOB_PHOTO: {
    id: 'JOB_PHOTO',
    nameBn: 'সরকারি চাকরি ছবি (300x300 px)',
    nameEn: 'Govt Job Photo (300x300 px)',
    widthMm: 38.1,
    heightMm: 38.1,
    aspectRatio: 1,
    description: 'Teletalk, BPSC, Primary চাকরি আবেদন (Max 100KB)',
  },
  JOB_SIGN: {
    id: 'JOB_SIGN',
    nameBn: 'স্বাক্ষর (300x80 px)',
    nameEn: 'Govt Job Signature (300x80 px)',
    widthMm: 50.8,
    heightMm: 13.5,
    aspectRatio: 300 / 80,
    description: 'Teletalk ও চাকরির অনলাইন আবেদন স্বাক্ষর (Max 60KB)',
  },
};

export interface StudioBgColor {
  id: string;
  nameBn: string;
  hex: string;
  category: 'sky_blue' | 'blue' | 'white' | 'gray' | 'red' | 'custom';
}

export const STUDIO_BG_COLORS: StudioBgColor[] = [
  { id: 'sky_light', nameBn: 'হালকা নীল (স্টুডিও স্কাই)', hex: '#87CEEB', category: 'sky_blue' },
  { id: 'bd_sky', nameBn: 'বিডি পাসপোর্ট স্কাই ব্লু', hex: '#5B92E5', category: 'sky_blue' },
  { id: 'royal_blue', nameBn: 'রয়্যাল ডার্ক ব্লু', hex: '#1E40AF', category: 'blue' },
  { id: 'white', nameBn: 'একদম সাদা (White)', hex: '#FFFFFF', category: 'white' },
  { id: 'off_white', nameBn: 'অফ হোয়াইট / ক্রিম', hex: '#F3F4F6', category: 'gray' },
  { id: 'light_gray', nameBn: 'হালকা ছাই কালার', hex: '#E5E7EB', category: 'gray' },
  { id: 'matte_red', nameBn: 'ভিসা রেড (লাল)', hex: '#DC2626', category: 'red' },
  { id: 'soft_green', nameBn: 'গ্রিন ব্যাকগ্রাউন্ড', hex: '#10B981', category: 'custom' },
];

export interface PrintItem {
  id: string;
  type: 'passport' | 'stamp' | 'joint' | 'nid' | 'custom';
  imageUrl: string;
  widthMm: number;
  heightMm: number;
  copies: number;
  hasBorder?: boolean;
}

export interface NidSettings {
  layout: 'side_by_side' | 'stacked' | 'photocopy_page' | 'four_r_duo';
  watermark: string;
  filterMode: 'color' | 'photocopy_bw' | 'grayscale' | 'high_contrast';
  border: boolean;
  scale: number;
  cardMarginMm: number;
  customWatermarkText?: string;
}

export interface CoupleJointSettings {
  person1: {
    x: number;
    y: number;
    scale: number;
    rotate: number;
    flipH: boolean;
    brightness: number;
    contrast: number;
  };
  person2: {
    x: number;
    y: number;
    scale: number;
    rotate: number;
    flipH: boolean;
    brightness: number;
    contrast: number;
  };
  bgColor: string;
  preset: string;
  order: 'p1_left' | 'p2_left';
  shoulderOverlap: number;
}
