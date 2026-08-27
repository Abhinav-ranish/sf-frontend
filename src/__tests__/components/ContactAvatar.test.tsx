import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO = "data:image/png;base64,YXZhdGFy";

describe("ContactAvatar", () => {
  it("renders a circular photo when one is present", () => {
    const { container } = render(<ContactAvatar contact={makeContact({ photo: PHOTO })} />);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", PHOTO);
    expect(image).toHaveClass("rounded-full", "object-cover");
  });

  it("falls back to initials when no photo is present", () => {
    const { container } = render(<ContactAvatar contact={makeContact()} />);

    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
