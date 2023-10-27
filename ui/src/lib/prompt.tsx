/**
 * Prompts a user when they exit the page
 *
 * References:
 * - The up-to-date solution: https://gist.github.com/MarksCode/64e438c82b0b2a1161e01c88ca0d0355
 * - https://reactrouter.com/en/v6.3.0/upgrading/v5#prompt-is-not-currently-supported
 * - https://gist.github.com/rmorse/426ffcc579922a82749934826fa9f743
 * - https://github.com/remix-run/react-router/issues/9262
 * - The mega thread: https://github.com/remix-run/react-router/issues/8139
 */

import { useCallback, useContext, useEffect } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";

function useConfirmExit(confirmExit, when = true) {
  const { navigator } = useContext(NavigationContext);

  useEffect(() => {
    if (!when) {
      return;
    }

    const push = navigator.push;

    navigator.push = (...args) => {
      const result = confirmExit();
      if (result !== false) {
        push(...args);
      }
    };

    return () => {
      navigator.push = push;
    };
  }, [navigator, confirmExit, when]);
}

export function usePrompt(message, when = true) {
  useEffect(() => {
    if (when) {
      window.onbeforeunload = function () {
        return message;
      };
    }

    return () => {
      window.onbeforeunload = null;
    };
  }, [message, when]);

  const confirmExit = useCallback(() => {
    const confirm = window.confirm(message);
    return confirm;
  }, [message]);
  useConfirmExit(confirmExit, when);
}
