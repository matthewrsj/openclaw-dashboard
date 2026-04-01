import { describe, it, expect } from "vitest";
import { render, screen } from "../../helpers/render";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("has border and background classes", () => {
    const { container } = render(<Card>Card</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
  });

  it("merges custom className", () => {
    const { container } = render(<Card className="custom">Card</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("custom");
  });
});

describe("CardHeader", () => {
  it("renders children with padding", () => {
    render(<CardHeader>Header</CardHeader>);
    const el = screen.getByText("Header");
    expect(el.className).toContain("p-4");
  });
});

describe("CardTitle", () => {
  it("renders as h3 with font-semibold", () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.tagName).toBe("H3");
    expect(el.className).toContain("font-semibold");
  });
});

describe("CardDescription", () => {
  it("renders with secondary text color", () => {
    render(<CardDescription>Description</CardDescription>);
    const el = screen.getByText("Description");
    expect(el.className).toContain("text-text-secondary");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});

describe("CardFooter", () => {
  it("renders with flex layout", () => {
    render(<CardFooter>Footer</CardFooter>);
    const el = screen.getByText("Footer");
    expect(el.className).toContain("flex");
  });
});
