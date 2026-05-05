import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['AI Research', 'AR/VR', 'Simulation', 'Game Dev', 'Architecture']),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { blog };
