import { useState } from 'react';
import { Recipe, AgeGroup } from '@/types';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/common/Button';
import { createCustomRecipe } from '@/utils/recipeGenerator';

interface CustomRecipeFormProps {
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function CustomRecipeForm({ onSave, onCancel }: CustomRecipeFormProps) {
  const { settings } = useStore();
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      alert('请填写菜名');
      return;
    }

    const recipe = createCustomRecipe(
      name,
      ingredients,
      steps,
      settings.babyAge as AgeGroup
    );

    onSave(recipe);
  };

  return (
    <div className="space-y-4">
      {/* 菜名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          菜名
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：番茄炒蛋"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* 食材 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          食材（每行一个，格式：食材名,用量）
        </label>
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="番茄,1个&#10;鸡蛋,2个&#10;盐,适量"
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      {/* 烹饪步骤 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          烹饪步骤（每行一步）
        </label>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder="番茄切块&#10;鸡蛋打散炒熟盛出&#10;锅中放油，炒番茄&#10;加入鸡蛋翻炒"
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      {/* 按钮 */}
      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} variant="primary" className="flex-1">
          保存
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          取消
        </Button>
      </div>
    </div>
  );
}