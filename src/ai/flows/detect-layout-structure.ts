'use server';

/**
 * @fileOverview An AI agent to detect layout structure from an image.
 *
 * - detectLayoutStructure - A function that handles the layout detection process.
 * - DetectLayoutStructureInput - The input type for the detectLayoutStructure function.
 * - DetectLayoutStructureOutput - The return type for the detectLayoutStructure function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectLayoutStructureInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The image to be processed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DetectLayoutStructureInput = z.infer<typeof DetectLayoutStructureInputSchema>;

const BoxSchema = z.object({
    x: z.number().describe('The x-coordinate of the top-left corner of the box.'),
    y: z.number().describe('The y-coordinate of the top-left corner of the box.'),
    width: z.number().describe('The width of the box.'),
    height: z.number().describe('The height of the box.'),
});

const DetectLayoutStructureOutputSchema = z.object({
  boxes: z.array(BoxSchema).describe('An array of boxes detected in the image.')
});
export type DetectLayoutStructureOutput = z.infer<typeof DetectLayoutStructureOutputSchema>;

export async function detectLayoutStructure(input: DetectLayoutStructureInput): Promise<DetectLayoutStructureOutput> {
  return detectLayoutStructureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectLayoutStructurePrompt',
  input: {schema: DetectLayoutStructureInputSchema},
  output: {schema: DetectLayoutStructureOutputSchema},
  prompt: `You are an AI layout detection expert. Your task is to analyze the provided image and identify the overall layout structure.

First, identify the main bounding box that encompasses all the layout elements.

Then, identify all the individual rectangular content boxes within that main bounding box. The coordinates for these inner boxes should be relative to the top-left corner of the image. Ensure that the alignment and relative positions of these boxes are maintained as they appear in the source image.

Return an array of objects, where each object represents a detected content box and has 'x', 'y', 'width', and 'height' properties.

Image: {{media url=imageDataUri}}`,
});

const detectLayoutStructureFlow = ai.defineFlow(
  {
    name: 'detectLayoutStructureFlow',
    inputSchema: DetectLayoutStructureInputSchema,
    outputSchema: DetectLayoutStructureOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
