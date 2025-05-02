export interface ExampleLecture {
  id: string;
  title: string;
  subject: string;
  content: string;
}

export const exampleLectures: ExampleLecture[] = [
  {
    id: 'pythagorean-theorem',
    title: 'The Pythagorean Theorem',
    subject: 'Mathematics - Geometry',
    content: `Today we're going to discuss one of the most fundamental concepts in geometry: the Pythagorean Theorem.

The Pythagorean Theorem states that in a right-angled triangle, the square of the length of the hypotenuse (the side opposite the right angle) is equal to the sum of the squares of the other two sides.

Mathematically, we express this as: a² + b² = c²

Where:
- a and b are the lengths of the two legs of the right triangle
- c is the length of the hypotenuse

This theorem is named after the ancient Greek mathematician Pythagoras, though there is evidence that the relationship was known earlier in Babylonian and Egyptian mathematics.

Let's look at some practical applications:

1. If we have a right triangle with legs of length 3 and 4 units, we can find the hypotenuse:
   c² = 3² + 4² = 9 + 16 = 25
   c = 5 units

2. The theorem can be used to determine if a triangle is a right triangle. If a, b, and c are the sides of a triangle and a² + b² = c² (where c is the longest side), then the triangle has a right angle.

3. In construction, the 3-4-5 triangle is often used to ensure corners are square (at 90 degrees).

The Pythagorean Theorem extends to higher dimensions as well. In three-dimensional space, the distance between two points can be calculated using a similar formula.

For homework, I'd like you to solve the following problems:
1. Find the hypotenuse of a right triangle with legs of length 5 and 12 units.
2. If a ladder 10 feet long is leaning against a wall and the bottom of the ladder is 6 feet from the wall, how high up the wall does the ladder reach?
3. Determine whether a triangle with sides of length 8, 15, and 17 units is a right triangle.`
  },
  {
    id: 'quadratic-equations',
    title: 'Solving Quadratic Equations',
    subject: 'Mathematics - Algebra',
    content: `Welcome to today's algebra lecture on solving quadratic equations.

A quadratic equation is a second-degree polynomial equation in a single variable, typically written in the form:
ax² + bx + c = 0

Where a, b, and c are constants, and a ≠ 0.

There are several methods to solve quadratic equations:

1. Factoring Method:
   If we can factor the quadratic expression into the form (px + q)(rx + s) = 0, then we can set each factor equal to zero and solve for x.
   Example: x² - 5x + 6 = 0 can be factored as (x - 2)(x - 3) = 0
   So, x = 2 or x = 3

2. Quadratic Formula:
   For any quadratic equation ax² + bx + c = 0, the solutions are given by:
   x = (-b ± √(b² - 4ac)) / 2a
   
   The expression b² - 4ac is called the discriminant. It tells us about the nature of the roots:
   - If b² - 4ac > 0, there are two distinct real roots
   - If b² - 4ac = 0, there is one repeated real root
   - If b² - 4ac < 0, there are two complex conjugate roots

3. Completing the Square:
   This method involves rewriting the quadratic equation in the form (x + p)² = q.
   Example: x² + 6x + 8 = 0
   x² + 6x = -8
   x² + 6x + 9 = -8 + 9 (adding 9 to complete the square)
   (x + 3)² = 1
   x + 3 = ±1
   x = -3 ± 1
   So, x = -2 or x = -4

Let's practice with a few examples:
1. Solve x² - 7x + 12 = 0 using factoring.
2. Solve 2x² + 5x - 3 = 0 using the quadratic formula.
3. Solve x² - 6x + 8 = 0 by completing the square.

For homework, please solve the following quadratic equations using any method you prefer:
1. x² - x - 6 = 0
2. 3x² - 5x - 2 = 0
3. 2x² + 7x + 3 = 0`
  },
  {
    id: 'cellular-respiration',
    title: 'Cellular Respiration',
    subject: 'Biology',
    content: `Today's lecture focuses on cellular respiration, the process by which cells convert nutrients into energy.

Cellular respiration is a set of metabolic reactions and processes that take place in the cells of organisms to convert biochemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products.

The reactions involved in cellular respiration can be divided into three main stages:

1. Glycolysis:
   - Occurs in the cytoplasm of the cell
   - Glucose (a 6-carbon molecule) is broken down into two molecules of pyruvate (3-carbon molecules)
   - Produces a net gain of 2 ATP and 2 NADH molecules
   - Does not require oxygen (anaerobic)

2. Krebs Cycle (Citric Acid Cycle):
   - Takes place in the mitochondrial matrix
   - Pyruvate is converted to acetyl-CoA, which enters the cycle
   - For each glucose molecule, the cycle runs twice (once for each pyruvate)
   - Produces 2 ATP, 6 NADH, and 2 FADH₂ molecules per glucose
   - Requires oxygen (aerobic)

3. Electron Transport Chain (ETC):
   - Located in the inner mitochondrial membrane
   - NADH and FADH₂ from earlier stages donate electrons
   - As electrons move through the chain, energy is released to pump protons
   - The proton gradient drives ATP synthesis via ATP synthase
   - Produces about 28 ATP molecules per glucose
   - Oxygen serves as the final electron acceptor, forming water

The overall chemical equation for cellular respiration is:
C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ~36 ATP

In the absence of oxygen, cells can still produce some ATP through:
- Lactic acid fermentation (in animal cells)
- Alcoholic fermentation (in yeast and some plant cells)

However, these processes are much less efficient, producing only 2 ATP per glucose molecule.

The efficiency of cellular respiration is about 40%, with the rest of the energy released as heat. This heat helps maintain body temperature in warm-blooded animals.

For next class, please review the electron transport chain in detail and be prepared to discuss how various factors (temperature, pH, enzyme inhibitors) affect the rate of cellular respiration.`
  }
];

export function getExampleLecture(id: string): ExampleLecture | undefined {
  return exampleLectures.find(lecture => lecture.id === id);
}

export function getAllExampleLectures(): ExampleLecture[] {
  return exampleLectures;
}
