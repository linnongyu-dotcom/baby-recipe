/**
 * 饭小宝 · 统一品牌配置
 *
 * 所有品牌相关信息统一维护在此文件中。
 * 修改此处后，全站 Logo、名称、品牌色、SEO 信息等自动更新。
 * 禁止在各页面中写死品牌文本或资源路径。
 */

// ============================================================
// 基础信息
// ============================================================

export const BRAND = {
  /** 产品名称 */
  name: '饭小宝',
  /** 产品简称 */
  shortName: '饭小宝',
  /** 产品副标题 */
  subtitle: '宝宝营养食谱管家',
  /** 产品描述 */
  description:
    '根据宝宝年龄、饮食需求和过敏信息，为你安排每一餐，让科学喂养变得简单。',
  /** 品牌口号 */
  slogan: '少一点纠结，多一点陪伴。',
  /** 作者 */
  author: '饭小宝',
} as const;

// ============================================================
// 品牌颜色
// ============================================================

export const BRAND_COLORS = {
  /** 主色（Primary） */
  primary: '#A78BFA',
  /** 主色深色变体 */
  primaryDark: '#8B5CF6',
  /** 主色更深变体 */
  primaryDarker: '#7C3AED',
  /** 辅助色 */
  secondary: '#C4B5FD',
  /** 背景色 */
  background: '#F5F0FF',
  /** Theme Color（浏览器标签栏/状态栏颜色） */
  themeColor: '#A78BFA',
} as const;

// ============================================================
// Logo & Icons
// ============================================================

export const BRAND_ASSETS = {
  /** Logo */
  logo: '/饭小宝头像.png',
  /** Favicon */
  favicon: '/饭小宝头像.png',
  /** Apple Touch Icon */
  appleTouchIcon: '/饭小宝头像.png',
  /** Android Icon */
  androidIcon: '/饭小宝头像.png',
  /** 分享图片（OG Image） */
  ogImage: '/饭小宝头像.png',
} as const;

// ============================================================
// SEO 默认信息
// ============================================================

export const SEO = {
  /** 默认 Title */
  title: '饭小宝 - 宝宝营养食谱管家',
  /** 默认 Description */
  description:
    '饭小宝，科学搭配每一餐，让喂养更简单。根据宝宝年龄、过敏信息智能生成一周食谱。',
  /** 默认 Keywords */
  keywords: [
    '宝宝食谱',
    '婴儿辅食',
    '营养食谱',
    '科学喂养',
    '饭小宝',
    '一周食谱',
    '宝宝吃什么',
    '辅食添加',
  ].join(', '),
  /** Open Graph */
  og: {
    title: '饭小宝 - 宝宝营养食谱管家',
    description:
      '饭小宝，科学搭配每一餐，让喂养更简单。根据宝宝年龄、过敏信息智能生成一周食谱。',
    image: '/饭小宝头像.png',
    type: 'website',
    locale: 'zh_CN',
    siteName: '饭小宝',
  },
  /** Twitter Card */
  twitter: {
    card: 'summary',
    title: '饭小宝 - 宝宝营养食谱管家',
    description: '科学搭配每一餐，让喂养更简单。',
    image: '/饭小宝头像.png',
  },
} as const;

// ============================================================
// PWA 信息
// ============================================================

export const PWA = {
  /** App Name */
  appName: '饭小宝',
  /** Short Name */
  shortName: '饭小宝',
  /** Theme Color */
  themeColor: '#A78BFA',
  /** Background Color */
  backgroundColor: '#F5F0FF',
  /** Manifest Icons */
  icons: [
    { src: '/饭小宝头像.png', sizes: '512x512', type: 'image/png' },
  ],
} as const;

// ============================================================
// Header
// ============================================================

export const HEADER = {
  /** Header Logo */
  logo: BRAND_ASSETS.logo,
  /** Header 产品名称 */
  name: BRAND.name,
  /** Header 副标题 */
  subtitle: BRAND.subtitle,
} as const;

// ============================================================
// Footer
// ============================================================

export const FOOTER = {
  /** Footer 品牌名称 */
  name: BRAND.name,
  /** 版权文本模板，{year} 会被替换为当前年份 */
  copyright: `© {year} ${BRAND.name}`,
} as const;

// ============================================================
// 分享信息
// ============================================================

export const SHARE = {
  /** 分享 Logo */
  logo: BRAND_ASSETS.logo,
  /** 分享标题 */
  title: '饭小宝 - 宝宝营养食谱管家',
  /** 分享描述 */
  description: '科学搭配每一餐，让喂养更简单。',
} as const;

// ============================================================
// 工具函数
// ============================================================

/** 获取当前年份的版权文本 */
export function getCopyright(): string {
  return FOOTER.copyright.replace('{year}', String(new Date().getFullYear()));
}

/** 设置页面标题，追加品牌后缀 */
export function setPageTitle(pageTitle?: string): void {
  document.title = pageTitle
    ? `${pageTitle} | ${BRAND.name}`
    : SEO.title;
}
