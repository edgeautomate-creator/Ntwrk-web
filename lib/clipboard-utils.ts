/**
 * Robust clipboard utility with fallback support for cross-browser compatibility
 * Handles HTTPS requirements, permission issues, and provides fallback mechanisms
 */

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

/**
 * Copy text to clipboard with multiple fallback strategies
 * @param text The text to copy to clipboard
 * @returns Promise with success status and optional error message
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  if (!text) {
    return {
      success: false,
      error: 'No text to copy'
    };
  }

  // Strategy 1: Try modern Clipboard API (requires HTTPS in production)
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback method:', err);
      // Continue to fallback method
    }
  }

  // Strategy 2: Fallback using execCommand (works in more browsers/contexts)
  try {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Make it invisible but still focusable
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.setAttribute('tabindex', '-1');

    document.body.appendChild(textarea);

    // Focus and select the text
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    // Try to copy
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (e) {
      console.error('execCommand failed:', e);
    }

    // Clean up
    document.body.removeChild(textarea);

    if (successful) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Copy command failed. Please copy manually.'
      };
    }
  } catch (err) {
    console.error('Fallback clipboard method failed:', err);
    return {
      success: false,
      error: 'Unable to copy automatically. Please copy manually.'
    };
  }
}

/**
 * Check if clipboard write is supported in the current context
 * @returns boolean indicating if clipboard operations are likely to work
 */
export function isClipboardSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  return !!(
    navigator.clipboard ||
    document.queryCommandSupported?.('copy') ||
    document.execCommand
  );
}
