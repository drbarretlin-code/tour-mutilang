import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only root HTML document (Expo Router).
 *
 * 關鍵：以 `translate="no"` / `notranslate` 停用瀏覽器（尤其是 Chrome 的 Google 翻譯）
 * 的自動翻譯。本 App 已內建自己的 i18n 多語系，瀏覽器翻譯不僅多餘，更會直接竄改
 * React 管理的文字節點，導致 react-native-web 在重新渲染時拋出
 * "Failed to execute 'insertBefore' on 'Node'" 的 DOM 重建崩潰。
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hant" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* 停用 Google / 瀏覽器自動翻譯，避免文字節點被竄改造成 insertBefore 崩潰 */}
        <meta name="google" content="notranslate" />

        <ScrollViewStyleReset />
      </head>
      <body className="notranslate">{children}</body>
    </html>
  );
}
