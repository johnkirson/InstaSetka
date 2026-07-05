export type FontOption = {
  family: string;
  label: string;
  stack: string;
};

export const googleFontOptions: FontOption[] = [
  { family: "Inter", label: "Inter", stack: "\"Inter\", Arial, sans-serif" },
  { family: "Roboto", label: "Roboto", stack: "\"Roboto\", Arial, sans-serif" },
  { family: "Open Sans", label: "Open Sans", stack: "\"Open Sans\", Arial, sans-serif" },
  { family: "Montserrat", label: "Montserrat", stack: "\"Montserrat\", Arial, sans-serif" },
  { family: "Poppins", label: "Poppins", stack: "\"Poppins\", Arial, sans-serif" },
  { family: "Lato", label: "Lato", stack: "\"Lato\", Arial, sans-serif" },
  { family: "Noto Sans", label: "Noto Sans", stack: "\"Noto Sans\", Arial, sans-serif" },
  { family: "Manrope", label: "Manrope", stack: "\"Manrope\", Arial, sans-serif" },
  { family: "DM Sans", label: "DM Sans", stack: "\"DM Sans\", Arial, sans-serif" },
  { family: "Playfair Display", label: "Playfair Display", stack: "\"Playfair Display\", Georgia, serif" },
];
