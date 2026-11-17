import { expect, test } from "bun:test";

import { nextStep, stepTimes } from "./steps";

const event = (from: string | null, to: string, at: string) => ({
  from_status: from,
  to_status: to,
  created_at: at,
});

test("each step's time is when the job reached it", () => {
  const times = stepTimes([
    event("customer_confirmed", "driver_requested", "t1"),
    event("driver_requested", "driver_assigned", "t2"),
    event("driver_assigned", "driver_at_store", "t3"),
  ]);
  expect(times.postedAt).toBe("t1");
  expect(times.reachedAt).toEqual({
    driver_assigned: "t2",
    driver_at_store: "t3",
  });
  expect(times.releasedAt).toBeNull();
});

test("a release starts the steps over for the next driver", () => {
  const times = stepTimes([
    event("customer_confirmed", "driver_requested", "t1"),
    event("driver_requested", "driver_assigned", "t2"),
    event("driver_assigned", "driver_at_store", "t3"),
    event("driver_at_store", "driver_requested", "t4"),
    event("driver_requested", "driver_assigned", "t5"),
  ]);
  expect(times.postedAt).toBe("t4");
  expect(times.releasedAt).toBe("t4");
  expect(times.reachedAt).toEqual({ driver_assigned: "t5" });
});

test("the next step follows the status, and there is none once delivered", () => {
  expect(nextStep("driver_assigned")?.to).toBe("driver_at_store");
  expect(nextStep("en_route")?.to).toBe("delivered");
  expect(nextStep("delivered")).toBeNull();
});
