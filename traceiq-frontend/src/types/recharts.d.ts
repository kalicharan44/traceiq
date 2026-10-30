/* Recharts ships a `types` entry, but the installed package omitted its declarations. */
declare module 'recharts' {
  import type { ComponentType, ReactNode } from 'react';

  interface Margin { top?: number; right?: number; bottom?: number; left?: number }
  interface TickStyle { fill?: string; fontSize?: number }
  interface ChartFrameProps { data?: readonly object[]; margin?: Margin; children?: ReactNode; layout?: 'horizontal' | 'vertical' }

  export const ResponsiveContainer: ComponentType<{ width?: string | number; height?: string | number; children?: ReactNode }>;
  export const AreaChart: ComponentType<ChartFrameProps>;
  export const BarChart: ComponentType<ChartFrameProps>;
  export const PieChart: ComponentType<ChartFrameProps>;
  export const Area: ComponentType<{
    type?: string;
    dataKey?: string;
    name?: string;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    activeDot?: { r?: number; strokeWidth?: number; stroke?: string };
    dot?: boolean;
    isAnimationActive?: boolean;
  }>;
  export const Bar: ComponentType<{
    dataKey?: string;
    name?: string;
    radius?: number | [number, number, number, number];
    barSize?: number;
    isAnimationActive?: boolean;
    children?: ReactNode;
  }>;
  export const Pie: ComponentType<{
    data?: readonly object[];
    dataKey?: string;
    nameKey?: string;
    innerRadius?: string | number;
    outerRadius?: string | number;
    paddingAngle?: number;
    stroke?: string;
    isAnimationActive?: boolean;
    children?: ReactNode;
  }>;
  export const Cell: ComponentType<{ fill?: string; key?: string }>;
  export const LabelList: ComponentType<{ dataKey?: string; position?: string; fill?: string; fontSize?: number; formatter?: (value: unknown) => ReactNode }>;
  export const CartesianGrid: ComponentType<{ stroke?: string; strokeDasharray?: string; vertical?: boolean; horizontal?: boolean }>;
  export const XAxis: ComponentType<{
    dataKey?: string;
    type?: 'number' | 'category';
    allowDecimals?: boolean;
    tickFormatter?: (value: string | number) => string;
    tick?: TickStyle;
    tickLine?: boolean;
    axisLine?: boolean;
    minTickGap?: number;
  }>;
  export const YAxis: ComponentType<{
    dataKey?: string;
    type?: 'number' | 'category';
    allowDecimals?: boolean;
    width?: number;
    tick?: TickStyle;
    tickLine?: boolean;
    axisLine?: boolean;
    label?: { value?: string; angle?: number; position?: string; fill?: string; fontSize?: number; style?: { textAnchor?: string } };
  }>;
  export const Tooltip: ComponentType<{ content?: ReactNode }>;
}
