import asian from './seed-menus/asian.json'
import bar from './seed-menus/bar.json'
import burger from './seed-menus/burger.json'
import cafe from './seed-menus/cafe.json'
import fineDining from './seed-menus/fine-dining.json'
import pizza from './seed-menus/pizza.json'
import type { OnboardingMenuItem } from './state-machine'

export interface MenuSeedTemplate {
  id: string
  name: string
  description: string
  items: OnboardingMenuItem[]
}

export const MENU_SEED_TEMPLATES: MenuSeedTemplate[] = [
  burger,
  pizza,
  asian,
  fineDining,
  cafe,
  bar,
] as MenuSeedTemplate[]

export function getMenuSeedTemplate(id: string): MenuSeedTemplate | null {
  return MENU_SEED_TEMPLATES.find((template) => template.id === id) ?? null
}
