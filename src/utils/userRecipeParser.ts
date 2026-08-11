import type { AgeGroup, UserRecipe, UserRecipeIngredient, UserRecipeMealType, UserRecipeNutritionTag } from '@/types';

const heading = /^(食材|准备食材|所需食材|用料|做法|制作方法|步骤|制作步骤|烹饪步骤|适合月龄|适合年龄|小贴士|注意事项)\s*[：:]?\s*(.*)$/;
const detailedStepsHeading = /保姆级步骤\s*[：:]?\s*(.*)$/;
const noise = /^(#\S+\s*)+$|^(收藏|点赞|关注|转发).{0,10}$/;
const chineseStepMarker = /^\[([一二三四五六七八九十])R\]\s*/;
const socialMarker = /^\[[^\]\n]{1,12}R\]\s*/;
export type ParsedRecipe = Pick<UserRecipe, 'name'|'ingredients'|'steps'|'ageRanges'|'mealTypes'|'nutritionTags'|'safetyNotes'|'originalText'> & { incomplete: boolean; multiple: boolean };

const uid = () => `ing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
function ingredient(value: string): UserRecipeIngredient | null {
  const clean = value.replace(/^[-•·*\d.、)）\s]+/, '').trim();
  if (!clean) return null;
  const match = clean.match(/^(.+?)(?:\s+|[,，:：])((?:约)?\d+(?:\.\d+)?(?:克|g|毫升|ml|个|颗|片|勺|杯|段|根)|适量|少许)$/i);
  return { id: uid(), name: (match?.[1] || clean).trim(), ...(match?.[2] ? { amount: match[2] } : {}) };
}
export function parseUserRecipeText(raw: string): ParsedRecipe {
  const originalText = raw.slice(0, 30000);
  // 小红书复制文本常带有“[一R]”“[种草R]”等图片标记：序号标记转成步骤，装饰标记直接移除。
  const lines = originalText.replace(/\r/g, '').split('\n').map(value => {
    const trimmed = value.trim();
    const numbered = trimmed.match(chineseStepMarker);
    return numbered ? trimmed.replace(chineseStepMarker, `第${numbered[1]}步 `) : trimmed.replace(socialMarker, '');
  }).filter(v => v && !noise.test(v));
  let section: 'ingredients'|'steps'|'age'|'tips'|null = null;
  let name = ''; const ingredients: UserRecipeIngredient[] = []; const steps: string[] = []; const tips: string[] = [];
  const addSteps = (value: string) => {
    const chunks = value
      .split(/\s+(?=(?:第[一二三四五六七八九十]+步|[（(]?\d+[.、)）]))/)
      .map(part => part.replace(/^(?:第[一二三四五六七八九十]+步[：:]?|[（(]?\d+[.、)）])\s*/, '').trim())
      .filter(Boolean);
    steps.push(...chunks);
  };
  const addSectionContent = (value: string) => {
    if (!value) return;
    if (section === 'ingredients') value.split(/[、，,；;]/).forEach(v => { const x = ingredient(v); if (x) ingredients.push(x); });
    else if (section === 'steps') addSteps(value);
    else if (section === 'tips') tips.push(value);
  };
  for (const line of lines) {
    // “保姆级步骤”前常混有 emoji、账号文案或平台标记，不能要求它位于行首。
    // 一旦出现该标题，下面的普通文本行也都按步骤处理，直到遇到其他分区标题。
    const detailedSteps = line.match(detailedStepsHeading);
    if (detailedSteps) {
      section = 'steps';
      addSectionContent(detailedSteps[1]);
      continue;
    }
    const h = line.match(heading);
    if (h) {
      section = /食材|用料/.test(h[1]) ? 'ingredients' : /做法|步骤|烹饪/.test(h[1]) ? 'steps' : /年龄|月龄/.test(h[1]) ? 'age' : 'tips';
      // 同一行标题后的正文必须立刻按当前分区处理；放到末尾会被后续标题改变分区。
      addSectionContent(h[2]);
      continue;
    }
    if (!name && !/^(宝宝|辅食)/.test(line) && line.length <= 40 && !/^\d+[.、]/.test(line)) { name = line.replace(/[：:]$/, ''); continue; }
    if (section === 'ingredients') line.split(/[、，,；;]/).forEach(v => { const x = ingredient(v); if (x) ingredients.push(x); });
    else if (section === 'steps' || /^(?:第[一二三四五六七八九十]+步|[（(]?\d+[.、)）])/.test(line)) addSteps(line);
    else if (section === 'tips') tips.push(line);
  }
  if (!name) name = lines[0]?.slice(0, 40) || '';
  // 无标题时，保守地把步骤前的短行识别为食材，原文始终保留供用户修正。
  if (!ingredients.length) lines.slice(1).filter(v => v.length < 30 && !/^(做法|步骤|\d+[.、])/.test(v)).slice(0, 8).forEach(v => { const x = ingredient(v); if (x) ingredients.push(x); });
  const ages: AgeGroup[] = [];
  const ageText = originalText;
  if (/6\s*[-到至~～]\s*8\s*个?月/.test(ageText)) ages.push('6-8m');
  if (/9\s*[-到至~～]\s*11\s*个?月|(?:9|10|11)\s*个?月/.test(ageText)) ages.push('9-11m');
  if (/1\s*[-到至~～]\s*2\s*岁|1岁以上/.test(ageText)) ages.push('1-2y');
  if (/2\s*[-到至~～]\s*3\s*岁/.test(ageText)) ages.push('2-3y');
  if (/3\s*[-到至~～]\s*5\s*岁/.test(ageText)) ages.push('3-5y');
  const meals: UserRecipeMealType[] = (['breakfast','lunch','dinner','snack'] as const).filter((_, i) => originalText.includes(['早餐','午餐','晚餐','加餐'][i]));
  const tags: UserRecipeNutritionTag[] = [];
  const rules: [UserRecipeNutritionTag, RegExp][] = [['谷薯类',/米|面|粥|燕麦|土豆|山药/],['肉类',/猪|牛|羊|鸡肉|肉末/],['鱼虾',/鱼|虾|贝/],['蛋类',/鸡蛋|蛋黄|蛋清/],['豆制品',/豆腐|豆浆|豆制品/],['蔬菜',/菜|胡萝卜|番茄|南瓜|西兰花/],['水果',/水果|苹果|香蕉|梨|蓝莓/],['奶制品',/牛奶|酸奶|奶酪/]];
  rules.forEach(([tag, re]) => { if (re.test(originalText)) tags.push(tag); });
  return { name, ingredients, steps, ageRanges: ages, mealTypes: meals, nutritionTags: tags, safetyNotes: tips.join('\n'), originalText, incomplete: !name || !ingredients.length || !steps.length, multiple: (originalText.match(/(?:食材|用料)\s*[：:]/g)?.length || 0) > 1 };
}
