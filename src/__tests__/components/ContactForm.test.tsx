import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";
import type { FormState } from "@/lib/contacts/types";

const PHOTO = "data:image/png;base64,YXZhdGFy";

function renderForm(action: jest.Mock, contact?: ReturnType<typeof makeContact>) {
  return render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Create contact"
      cancelHref="/contacts"
    />,
  );
}

describe("ContactForm", () => {
  it("renders every editable field", () => {
    renderForm(jest.fn());

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/profile image/i)).not.toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
    expect(screen.getByRole("button", { name: /add address/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
  });

  it("prefills from an existing contact", () => {
    const { container } = renderForm(jest.fn(), makeContact({ photo: PHOTO }));

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("ada@example.com");
    // Nulls become empty inputs rather than the string "null".
    expect(screen.getByLabelText(/street address/i)).toHaveValue("");
    expect(container.querySelector('input[name="photo"]')).toHaveValue(PHOTO);
  });

  it("preserves the current photo and blocks submit while reading a replacement", async () => {
    const originalFileReader = global.FileReader;
    const readers: Array<{
      result: string | ArrayBuffer | null;
      onload: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null;
      onerror: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null;
      readAsDataURL: jest.Mock;
    }> = [];

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((this: FileReader, event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL = jest.fn();

      constructor() {
        readers.push(this);
      }
    }

    Object.defineProperty(global, "FileReader", {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });

    try {
      const { container } = renderForm(jest.fn(), makeContact({ photo: PHOTO }));
      const hiddenPhoto = container.querySelector<HTMLInputElement>('input[name="photo"]');
      const submit = screen.getByRole("button", { name: /create contact/i });

      await userEvent.upload(
        screen.getByLabelText(/profile image/i),
        new File(["new"], "avatar.png", { type: "image/png" }),
      );

      expect(hiddenPhoto).toHaveValue(PHOTO);
      expect(submit).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("Preparing image");

      act(() => {
        readers[0].result = "data:image/png;base64,bmV3";
        readers[0].onload?.call(
          readers[0] as unknown as FileReader,
          {} as ProgressEvent<FileReader>,
        );
      });

      await waitFor(() => expect(submit).not.toBeDisabled());
      expect(hiddenPhoto).toHaveValue("data:image/png;base64,bmV3");
    } finally {
      Object.defineProperty(global, "FileReader", {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
    }
  });

  it("submits the entered values to the action", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("first_name")).toBe("Grace");
    expect(formData.get("email")).toBe("grace@example.com");
  });

  it("submits dynamic address rows", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.type(screen.getByLabelText(/city/i), "Arlington");
    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "Work");
    await userEvent.type(screen.getAllByLabelText(/street address/i)[1], "88 Colin P Kelly Jr St");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("addresses.0.city")).toBe("Arlington");
    expect(formData.get("addresses.1.type")).toBe("Work");
    expect(formData.get("addresses.1.address")).toBe("88 Colin P Kelly Jr St");
  });

  it("blocks submit while an oversized photo selection is present", async () => {
    renderForm(jest.fn());

    const file = new File(["x".repeat(513 * 1024)], "avatar.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/profile image/i), file);

    expect(screen.getByText("Photo must be 512 KB or smaller.")).toBeVisible();
    expect(screen.getByRole("button", { name: /create contact/i })).toBeDisabled();
  });

  it("shows the summary and the per-field errors the action returns", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "That email address is already taken.",
        fieldErrors: { email: "This email is already in use." },
        values: { first_name: "Grace" },
      }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "That email address is already taken.",
        "This email is already in use.",
      ]),
    );
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("links back out without submitting", () => {
    renderForm(jest.fn());
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});
