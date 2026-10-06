// Branding shown in the interface. Set an entry to null to hide its element.
export const instance: {
  author: { name: string; url: string } | null;
  promo: { name: string; tagline: string; url: string } | null;
} = {
  author: { name: "Renan Abade", url: "https://renanabade.com/" },
  promo: {
    name: "eutimea",
    tagline: "Organize sua rotina e estudos",
    url: "https://eutimea.com/",
  },
};
