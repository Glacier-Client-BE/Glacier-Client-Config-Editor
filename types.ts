
export type ConfigVersion = 'v4' | 'v5' | 'v6';

export interface ConfigData {
  [key: string]: any;
}

export interface HUDModule {
  id: string;
  toggleKey: string;
  anchorKey: string;
  offsetKey: string;
  width: number;
  height: number;
  icon: string;
}

export type AnchorType = 
  | "top_left" | "top_middle" | "top_right" 
  | "left_middle" | "middle" | "right_middle" 
  | "bottom_left" | "bottom_middle" | "bottom_right";
