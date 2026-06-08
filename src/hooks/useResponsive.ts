import { useWindowDimensions } from 'react-native';

export interface ResponsiveDimensions {
  windowWidth: number;
  windowHeight: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeScreen: boolean; // Tablet or Desktop
}

export function useResponsive(): ResponsiveDimensions {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;
  const isLargeScreen = windowWidth >= 768;

  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isLargeScreen,
  };
}

export default useResponsive;
