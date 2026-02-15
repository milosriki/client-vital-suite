import { render, screen } from "@testing-library/react";
import { TruthTriangle } from "@/components/analytics/TruthTriangle";

describe("TruthTriangle", () => {
  it("should render all three nodes with correct labels", () => {
    render(
      <TruthTriangle
        hubspotValue={100000}
        stripeValue={95000}
        metaValue={90000}
      />
    );

    expect(screen.getByText("STRIPE")).toBeInTheDocument();
    expect(screen.getByText("HUBSPOT")).toBeInTheDocument();
    expect(screen.getByText("META")).toBeInTheDocument();
  });

  it("should format revenue values correctly", () => {
    render(
      <TruthTriangle
        hubspotValue={123456}
        stripeValue={234567}
        metaValue={345678}
      />
    );

    // Check that numbers are formatted (no decimals)
    expect(screen.getByText("123,456")).toBeInTheDocument();
    expect(screen.getByText("234,567")).toBeInTheDocument();
    expect(screen.getByText("345,678")).toBeInTheDocument();
  });

  it("should show 'UNIVERSAL TRUTH VERIFIED' when all values match within 1%", () => {
    // All values within 1% of each other
    const baseValue = 100000;
    render(
      <TruthTriangle
        hubspotValue={baseValue}
        stripeValue={baseValue + 500} // 0.5% difference
        metaValue={baseValue - 500} // 0.5% difference
      />
    );

    expect(screen.getByText("UNIVERSAL TRUTH VERIFIED")).toBeInTheDocument();
  });

  it("should show 'DATA DISCREPANCY DETECTED' when values differ by more than 1%", () => {
    render(
      <TruthTriangle
        hubspotValue={100000}
        stripeValue={95000} // 5% difference
        metaValue={90000} // 10% difference
      />
    );

    expect(screen.getByText("DATA DISCREPANCY DETECTED")).toBeInTheDocument();
  });

  it("should handle zero values without crashing", () => {
    render(
      <TruthTriangle hubspotValue={0} stripeValue={0} metaValue={0} />
    );

    expect(screen.getByText("STRIPE")).toBeInTheDocument();
    expect(screen.getByText("HUBSPOT")).toBeInTheDocument();
    expect(screen.getByText("META")).toBeInTheDocument();
  });

  it("should apply custom className when provided", () => {
    const { container } = render(
      <TruthTriangle
        hubspotValue={100000}
        stripeValue={100000}
        metaValue={100000}
        className="custom-class"
      />
    );

    const triangleContainer = container.querySelector(".custom-class");
    expect(triangleContainer).toBeInTheDocument();
  });

  it("should show discrepancy when only two values match", () => {
    render(
      <TruthTriangle
        hubspotValue={100000}
        stripeValue={100000} // Matches HubSpot
        metaValue={50000} // Does not match
      />
    );

    // Should still show discrepancy because not all three match
    expect(screen.getByText("DATA DISCREPANCY DETECTED")).toBeInTheDocument();
  });

  it("should render all Revenue labels", () => {
    render(
      <TruthTriangle
        hubspotValue={100000}
        stripeValue={100000}
        metaValue={100000}
      />
    );

    // Should have 3 "Revenue" labels (one per node)
    const revenueLabels = screen.getAllByText("Revenue");
    expect(revenueLabels).toHaveLength(3);
  });
});
