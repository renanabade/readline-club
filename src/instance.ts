// Branding shown in the interface. Set an entry to null to hide its element.
export const instance: {
  author: { name: string; url: string } | null;
  promo: { name: string; tagline: string; url: string } | null;
  privacy: { controller: string; contact: string };
} = {
  author: { name: "Renan Abade", url: "https://renanabade.com/" },
  promo: {
    name: "eutimea",
    tagline: "Organize sua rotina e estudos",
    url: "https://eutimea.com/",
  },
  // Named in the privacy policy as the person responsible for member data.
  privacy: { controller: "Renan Abade", contact: "renan@readline.club" },
};
