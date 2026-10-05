type TokenMap = Record<string, string>;
type FontSize = [size: string, options: { lineHeight: string }];

declare const preset: {
  content: string[];
  theme: {
    extend: {
      backgroundColor: TokenMap;
      textColor: TokenMap;
      borderColor: TokenMap;
      fontFamily: Record<string, string[]>;
      fontWeight: TokenMap;
      fontSize: Record<string, FontSize>;
      borderRadius: TokenMap;
      borderWidth: TokenMap;
    };
  };
};
export default preset;
