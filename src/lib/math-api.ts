const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

function validateAPIResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  return response;
}

export async function generateMathSolution(input: string) {
  try {
    if (!input.trim()) {
      throw new Error('Please provide a math problem to solve');
    }

    if (!API_BASE_URL) {
  throw new Error('API base URL is not configured');
}

const response = await fetch(`${API_BASE_URL}/math/solve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error('Failed to parse API response as JSON');
    }
  } catch (error) {
    console.error('Error generating math solution:', error);
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
}

export async function generateMathSolutionFromImage(imageData: string) {
  try {
    if (!imageData) {
      throw new Error('Please provide an image to process');
    }

    if (!API_BASE_URL) {
  throw new Error('API base URL is not configured');
}

const response = await fetch(`${API_BASE_URL}/math/solve-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'An error occurred while processing the image';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error('Failed to parse the solution response. The server returned an invalid format.');
    }
  } catch (error) {
    console.error('Error generating math solution from image:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while processing the image');
  }
}