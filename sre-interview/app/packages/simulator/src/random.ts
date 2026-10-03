import { faker } from "@faker-js/faker/locale/en";

export type Rng = () => number;

export const fakerRng: Rng = () => faker.number.float({ min: 0, max: 1 });

export function normal(rng: Rng, mean = 0, stdDev = 1): number {
  const u = 1 - rng();
  const v = rng();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function exponential(rng: Rng, mean: number): number {
  return -Math.log(1 - rng()) * mean;
}

export function float(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(float(rng, min, max + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
