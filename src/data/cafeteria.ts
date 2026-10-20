export type MealPeriod = "Breakfast" | "Lunch" | "Dinner";

export interface MenuItem {
  id: string;
  name: string;
  price: number; // EGP
  tags: string[];
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type DayName = (typeof DAYS)[number];

export const PERIODS: MealPeriod[] = ["Breakfast", "Lunch", "Dinner"];

const commonBreakfast: MenuItem[] = [
  { id: "b-foul", name: "Foul & Ta'meya plate", price: 25, tags: ["Vegetarian", "Filling"] },
  { id: "b-cheese", name: "Cheese sandwich", price: 22, tags: ["Vegetarian", "Quick"] },
  { id: "b-omelette", name: "Omelette sandwich", price: 28, tags: ["High protein"] },
  { id: "b-yogurt", name: "Yogurt & fruit cup", price: 20, tags: ["Light", "Vegetarian"] },
  { id: "b-tea", name: "Tea", price: 8, tags: ["Drink"] },
  { id: "b-coffee", name: "Turkish coffee", price: 15, tags: ["Drink"] },
];

const commonDinner: MenuItem[] = [
  { id: "d-shawarma", name: "Chicken shawarma sandwich", price: 45, tags: ["High protein"] },
  { id: "d-tuna", name: "Tuna sandwich", price: 32, tags: ["Quick"] },
  { id: "d-falafel", name: "Falafel wrap", price: 28, tags: ["Vegetarian"] },
  { id: "d-soup", name: "Lentil soup + bread", price: 20, tags: ["Vegetarian", "Light"] },
  { id: "d-feteer", name: "Feteer meshaltet (plain)", price: 35, tags: ["Vegetarian"] },
  { id: "d-fruit", name: "Seasonal fruit", price: 15, tags: ["Light", "Vegetarian"] },
];

const lunches: Record<DayName, MenuItem[]> = {
  Sunday: [
    { id: "l-sun-koshary", name: "Koshary", price: 35, tags: ["Vegetarian", "Filling"] },
    { id: "l-sun-chicken", name: "Chicken & rice", price: 70, tags: ["High protein"] },
    { id: "l-sun-pasta", name: "Pasta bolognese", price: 55, tags: [] },
    { id: "l-sun-salad", name: "Green salad", price: 15, tags: ["Vegetarian", "Light"] },
    { id: "l-sun-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Monday: [
    { id: "l-mon-beef", name: "Beef stew & rice", price: 85, tags: ["High protein"] },
    { id: "l-mon-curry", name: "Vegetable curry & rice", price: 45, tags: ["Vegetarian"] },
    { id: "l-mon-fish", name: "Grilled fish & rice", price: 75, tags: ["High protein"] },
    { id: "l-mon-rice", name: "Extra rice", price: 10, tags: ["Side"] },
    { id: "l-mon-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Tuesday: [
    { id: "l-tue-koshary", name: "Koshary", price: 35, tags: ["Vegetarian", "Filling"] },
    { id: "l-tue-grilled", name: "Grilled chicken & pasta", price: 80, tags: ["High protein"] },
    { id: "l-tue-liver", name: "Alexandrian liver sandwich", price: 50, tags: ["High protein"] },
    { id: "l-tue-salad", name: "Green salad", price: 15, tags: ["Vegetarian", "Light"] },
    { id: "l-tue-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Wednesday: [
    { id: "l-wed-moussaka", name: "Moussaka & rice", price: 50, tags: ["Vegetarian", "Filling"] },
    { id: "l-wed-chicken", name: "Chicken & rice", price: 70, tags: ["High protein"] },
    { id: "l-wed-kofta", name: "Kofta & rice", price: 75, tags: ["High protein"] },
    { id: "l-wed-soup", name: "Lentil soup + bread", price: 20, tags: ["Vegetarian", "Light"] },
    { id: "l-wed-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Thursday: [
    { id: "l-thu-koshary", name: "Koshary", price: 35, tags: ["Vegetarian", "Filling"] },
    { id: "l-thu-fish", name: "Grilled fish & rice", price: 75, tags: ["High protein"] },
    { id: "l-thu-pasta", name: "Pasta bolognese", price: 55, tags: [] },
    { id: "l-thu-salad", name: "Green salad", price: 15, tags: ["Vegetarian", "Light"] },
    { id: "l-thu-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Friday: [
    { id: "l-fri-koshary", name: "Koshary", price: 35, tags: ["Vegetarian", "Filling"] },
    { id: "l-fri-chicken", name: "Chicken & rice", price: 70, tags: ["High protein"] },
    { id: "l-fri-curry", name: "Vegetable curry & rice", price: 45, tags: ["Vegetarian"] },
    { id: "l-fri-fries", name: "French fries", price: 20, tags: ["Vegetarian", "Side"] },
    { id: "l-fri-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
  Saturday: [
    { id: "l-sat-beef", name: "Beef stew & rice", price: 85, tags: ["High protein"] },
    { id: "l-sat-falafel", name: "Falafel plate", price: 30, tags: ["Vegetarian"] },
    { id: "l-sat-pasta", name: "Pasta bolognese", price: 55, tags: [] },
    { id: "l-sat-salad", name: "Green salad", price: 15, tags: ["Vegetarian", "Light"] },
    { id: "l-sat-juice", name: "Fresh juice", price: 20, tags: ["Drink"] },
  ],
};

export function menuFor(day: DayName): Record<MealPeriod, MenuItem[]> {
  return {
    Breakfast: commonBreakfast,
    Lunch: lunches[day],
    Dinner: commonDinner,
  };
}

export function itemById(id: string): MenuItem | undefined {
  for (const day of DAYS) {
    const menu = menuFor(day);
    for (const period of PERIODS) {
      const found = menu[period].find((item) => item.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

export function formatEgp(value: number): string {
  return `${value.toLocaleString("en-EG")} EGP`;
}
