import {
  Apple, Beef, Croissant, Milk, Wheat, Wine, Snowflake, SprayCan, Sparkles, Baby, PawPrint, Package,
  ShoppingCart, ShoppingBasket, House, ListChecks, Wallet, Ellipsis, Camera, ScanBarcode, Plus, Minus, X, Check,
  ChevronDown, ChevronRight, ChevronLeft, Trash2, Pencil, Moon, Sun, Download, Upload, Share2, Store, MapPin,
  Calculator, Fuel, History, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Settings, Database, Info, TriangleAlert,
  CircleAlert, Flashlight, FlashlightOff, Image, Undo2, Search, Tag, Percent, Receipt, Target, PiggyBank,
  ChartColumn, ChartLine, Smartphone, WifiOff, RefreshCw, Save, Lock, Layers, Scale, Navigation, FileText,
  ArrowLeft, CircleCheck, Clock, ShieldCheck, Crop, Zap, LoaderCircle, Banknote, CreditCard, Star, Bell,
  type LucideProps,
} from 'lucide-react'
import type { ComponentType } from 'react'

const MAP = {
  Apple, Beef, Croissant, Milk, Wheat, Wine, Snowflake, SprayCan, Sparkles, Baby, PawPrint, Package,
  ShoppingCart, ShoppingBasket, House, ListChecks, Wallet, Ellipsis, Camera, ScanBarcode, Plus, Minus, X, Check,
  ChevronDown, ChevronRight, ChevronLeft, Trash2, Pencil, Moon, Sun, Download, Upload, Share2, Store, MapPin,
  Calculator, Fuel, History, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Settings, Database, Info, TriangleAlert,
  CircleAlert, Flashlight, FlashlightOff, Image, Undo2, Search, Tag, Percent, Receipt, Target, PiggyBank,
  ChartColumn, ChartLine, Smartphone, WifiOff, RefreshCw, Save, Lock, Layers, Scale, Navigation, FileText,
  ArrowLeft, CircleCheck, Clock, ShieldCheck, Crop, Zap, LoaderCircle, Banknote, CreditCard, Star, Bell,
} satisfies Record<string, ComponentType<LucideProps>>

export type IconName = keyof typeof MAP

export function Icon({ name, size, className, ...rest }: { name: IconName | string; size?: number; className?: string } & Omit<LucideProps, 'ref'>) {
  const C = (MAP as Record<string, ComponentType<LucideProps>>)[name] ?? Package
  return <C aria-hidden="true" focusable="false" className={className} {...(size ? { width: size, height: size } : {})} {...rest} />
}
