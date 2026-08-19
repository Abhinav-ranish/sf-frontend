import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteContactButton from "@/components/contacts/DeleteContactButton";
import { deleteContactAction } from "@/app/contacts/actions";

jest.mock("@/app/contacts/actions", () => ({
  deleteContactAction: jest.fn(async () => ({})),
}));

const mockedDelete = deleteContactAction as jest.MockedFunction<
  typeof deleteContactAction
>;

beforeEach(() => {
  mockedDelete.mockClear();
  mockedDelete.mockResolvedValue({});
});

function renderButton(redirectToList = false) {
  return render(
    <DeleteContactButton
      contactId={7}
      contactName="Ada Lovelace"
      redirectToList={redirectToList}
    />,
  );
}

describe("DeleteContactButton", () => {
  it("asks for confirmation before deleting anything", async () => {
    renderButton();

    await userEvent.click(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    );

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm deleting ada lovelace/i }),
    ).toBeInTheDocument();
  });

  it("deletes once confirmed", async () => {
    renderButton(true);

    await userEvent.click(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /confirm deleting ada lovelace/i }),
    );

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(7, true));
  });

  it("backs out on cancel", async () => {
    renderButton();

    await userEvent.click(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "No" }));

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    ).toBeInTheDocument();
  });

  it("reports a failure instead of pretending it worked", async () => {
    mockedDelete.mockResolvedValue({ error: "Contact 7 not found" });
    renderButton();

    await userEvent.click(
      screen.getByRole("button", { name: /delete ada lovelace/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /confirm deleting ada lovelace/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Contact 7 not found",
    );
  });
});
