'use server';

/**
 * @fileOverview An AI agent to extend the image to fill the box using a blur-edge or clone-fill method when the image is smaller than the box.
 *
 * - autoBackgroundFill - A function that handles the auto background fill process.
 * - AutoBackgroundFillInput - The input type for the autoBackgroundFill function.
 * - AutoBackgroundFillOutput - The return type for the autoBackgroundFill function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoBackgroundFillInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The image to be processed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  boxWidth: z.number().describe('The width of the box the image will be placed in.'),
  boxHeight: z.number().describe('The height of the box the image will be placed in.'),
});
export type AutoBackgroundFillInput = z.infer<typeof AutoBackgroundFillInputSchema>;

const AutoBackgroundFillOutputSchema = z.object({
  filledImageDataUri: z
    .string()
    .describe(
      'The processed image with extended background, as a data URI that must include a MIME type and use Base64 encoding. Expected format: data:<mimetype>;base64,<encoded_data>.'
    ),
});
export type AutoBackgroundFillOutput = z.infer<typeof AutoBackgroundFillOutputSchema>;

export async function autoBackgroundFill(input: AutoBackgroundFillInput): Promise<AutoBackgroundFillOutput> {
  return autoBackgroundFillFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoBackgroundFillPrompt',
  input: {schema: AutoBackgroundFillInputSchema},
  output: {schema: AutoBackgroundFillOutputSchema},
  prompt: `You are an AI image processing expert. You take an image and extend it to fill a specified box, using blur-edge or clone-fill methods.

  The image dimensions may be smaller than the box dimensions. In this case, extend the image to smoothly fill the box.

  You can choose to add a subtle shadow and gradient for a more natural blend.  Output the final image as a base64 encoded data URI.

  Image: {{media url=imageDataUri}}
  Box Width: {{{boxWidth}}} pixels
  Box Height: {{{boxHeight}}} pixels`,
});

const autoBackgroundFillFlow = ai.defineFlow(
  {
    name: 'autoBackgroundFillFlow',
    inputSchema: AutoBackgroundFillInputSchema,
    outputSchema: AutoBackgroundFillOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
