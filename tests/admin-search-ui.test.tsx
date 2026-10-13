// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Admin from "../src/pages/Admin";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(async () => {}),
  data: {} as Record<string, unknown>,
}));
vi.mock("../src/lib/api", () => ({ save: mocks.save, api: vi.fn() }));
vi.mock("../src/lib/useData", () => ({
  useData: () => ({
    data: mocks.data,
    loading: false,
    error: "",
    reload: mocks.reload,
  }),
}));
const person = (id: string, name: string, status: string, phone = "") => ({
  id,
  name,
  status,
  phone,
  email: id + "@example.test",
  created_at: "2026-09-28T12:00:00Z",
  experience: "beginner",
  motivation: "",
});
beforeEach(() => {
  mocks.save.mockReset();
  mocks.data = {
    applications: [
      person("joana", "Joana Araújo", "pending", "+5511912345678"),
      ...Array.from({ length: 40 }, (_, i) =>
        person("membro" + i, "Membro " + i, "approved"),
      ),
      person("caio", "Caio Lima", "suspended"),
    ],
    books: [],
    meetings: [],
    cycles: [],
    categories: [],
    resources: [],
    recordings: [],
    settings: {},
    invitations: [],
    rsvps: [],
    departures: [
      {
        id: "d1",
        name: "Pessoa que saiu",
        phone: "+5511900000000",
        left_at: "2026-10-01T12:00:00Z",
      },
    ],
  };
});
afterEach(cleanup);
const names = () =>
  screen
    .getAllByRole("article")
    .map((card) => card.querySelector("h3")?.textContent);

test("members are searched by name without accents, email or phone, and paged", () => {
  render(<Admin />);
  expect(names()).toHaveLength(30);
  fireEvent.click(screen.getByRole("button", { name: /Mostrar mais/ }));
  expect(names()).toHaveLength(42);
  const search = screen.getByRole("searchbox", {
    name: "Buscar por nome, e-mail ou celular",
  });
  fireEvent.change(search, { target: { value: "joana araujo" } });
  expect(names()).toEqual(["Joana Araújo"]);
  fireEvent.change(search, { target: { value: "91234" } });
  expect(names()).toEqual(["Joana Araújo"]);
  expect(
    screen.getByRole("link", { name: "+55 (11) 91234-5678" }),
  ).toBeTruthy();
  fireEvent.change(search, { target: { value: "caio@example" } });
  expect(names()).toEqual(["Caio Lima"]);
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Filtrar por situação" }),
    { target: { value: "suspended" } },
  );
  expect(names()).toEqual(["Caio Lima"]);
});

test("departures are listed for group removal and cleared on confirmation", async () => {
  mocks.save.mockResolvedValue({ ok: true });
  render(<Admin />);
  expect(screen.getByText("Pessoa que saiu")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Já retirei dos grupos" }),
  );
  expect(mocks.save).toHaveBeenCalledWith("/admin/departures/d1", {}, "DELETE");
  expect(
    await screen.findByText(
      "Saída concluída. Os dados da pessoa foram apagados.",
    ),
  ).toBeTruthy();
});
