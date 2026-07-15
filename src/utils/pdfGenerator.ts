import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { WeeklyPlan, DayOfWeek, MealType, DISH_TYPE_LABELS, DAY_LABELS, AGE_GROUP_LABELS, AgeGroup } from '@/types';

const MEAL_LABELS: Record<MealType, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
const MEAL_EMOJI: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const DPI_SCALE = 2;

function buildDayHTML(
  dayPlan: WeeklyPlan[DayOfWeek],
  day: DayOfWeek,
): string {
  let html = '';

  html += `<div style="margin-bottom:16px;padding:14px 16px;background:#faf5ff;border-radius:10px;border-left:4px solid #a78bfa;">`;
  html += `<h2 style="font-size:16px;font-weight:700;color:#5b21b6;margin:0 0 10px 0;">📅 ${DAY_LABELS[day]}</h2>`;

  for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
    const mealPlan = dayPlan[meal];
    const dishCount = mealPlan.dishes.length;

    html += `<div style="margin-bottom:10px;">`;
    html += `<h3 style="font-size:14px;font-weight:600;color:#374151;margin:0 0 6px 0;">${MEAL_EMOJI[meal]} ${MEAL_LABELS[meal]}（${dishCount}道菜）</h3>`;

    for (const dish of mealPlan.dishes) {
      const typeLabel = DISH_TYPE_LABELS[dish.dishType] || dish.dishType;
      html += `<div style="margin-bottom:8px;padding:8px 12px;background:#fff;border-radius:8px;border:1px solid #e5e7eb;">`;
      html += `<div style="font-size:13px;font-weight:600;color:#1f2937;margin-bottom:4px;">${dish.name} <span style="font-size:11px;color:#8b5cf6;background:#ede9fe;padding:1px 6px;border-radius:4px;margin-left:6px;">${typeLabel}</span></div>`;

      if (dish.ingredients.length > 0) {
        html += `<div style="font-size:11px;color:#6b7280;margin-bottom:3px;">`;
        html += `<span style="font-weight:600;">食材：</span>`;
        html += dish.ingredients.map(i => `${i.name}${i.amount}`).join('、');
        html += `</div>`;
      }

      if (dish.steps.length > 0) {
        html += `<div style="font-size:11px;color:#6b7280;line-height:1.6;">`;
        html += `<span style="font-weight:600;">做法：</span>`;
        html += dish.steps.map((s) => `①${s}`).join(' ②');
        html += `</div>`;
      }

      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  return html;
}

function buildRecipeHTML(weeklyPlan: WeeklyPlan, ageLabel: string, targetDay?: DayOfWeek | null): string {
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const isSingleDay = !!targetDay;
  const days: DayOfWeek[] = isSingleDay
    ? [targetDay!]
    : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  let html = '';
  html += `<div style="color:#4a4a4a;max-width:820px;padding:24px 28px;">`;

  if (isSingleDay) {
    html += `<h1 style="text-align:center;font-size:22px;font-weight:700;color:#6d28d9;margin:0 0 4px 0;">📖 宝宝今日营养食谱</h1>`;
  } else {
    html += `<h1 style="text-align:center;font-size:22px;font-weight:700;color:#6d28d9;margin:0 0 4px 0;">📖 宝宝一周营养食谱</h1>`;
  }
  html += `<p style="text-align:center;font-size:13px;color:#888;margin:0 0 20px 0;">${ageLabel} · ${dateStr}</p>`;

  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    html += buildDayHTML(weeklyPlan[day], day);
  }

  if (!isSingleDay) {
    const totalDishes = days.reduce((sum, day) => {
      for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
        sum += weeklyPlan[day][meal].dishes.length;
      }
      return sum;
    }, 0);
    html += `<p style="text-align:center;font-size:12px;color:#9ca3af;margin:10px 0 0 0;">共 7 天 × 21 餐 · ${totalDishes} 道菜品 · 用心为宝宝准备每一餐 ❤️</p>`;
  }

  html += `</div>`;

  return html;
}

export async function downloadRecipePDF(
  weeklyPlan: WeeklyPlan,
  babyAge: AgeGroup | null,
  targetDay?: DayOfWeek | null,
): Promise<void> {
  const ageLabel = babyAge ? AGE_GROUP_LABELS[babyAge] : '宝宝';

  const htmlContent = buildRecipeHTML(weeklyPlan, ageLabel, targetDay);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '840px';
  container.style.fontFamily = '-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
  container.style.lineHeight = '1.5';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: DPI_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = CONTENT_WIDTH_MM;
    const pageHeight = A4_HEIGHT_MM - MARGIN_MM * 2;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = pageWidth;
    const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

    const totalPages = Math.ceil(imgHeight / pageHeight);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }

      const sy = page * (pageHeight / imgHeight) * canvasHeight;
      const sh = Math.min(pageHeight / imgHeight * canvasHeight, canvasHeight - sy);
      const dy = MARGIN_MM;
      const dh = (sh / canvasHeight) * imgHeight;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvasWidth;
      pageCanvas.height = Math.round(sh);
      const ctx = pageCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, sy, canvasWidth, sh, 0, 0, canvasWidth, sh);
      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', MARGIN_MM, dy, pageWidth, dh);

      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`- ${page + 1}/${totalPages} -`, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 6, { align: 'center' });
    }

    const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    const title = targetDay ? `宝宝今日食谱_${DAY_LABELS[targetDay]}` : `宝宝一周食谱`;
    pdf.save(`${title}_${ageLabel}_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
