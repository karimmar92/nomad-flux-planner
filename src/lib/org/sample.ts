/**
 * Sample data for a new organisation's empty dashboard.
 *
 * The slowest part of every compliance tool is the first value: you have to
 * invite people, wait for them to log trips, and only then see what the product
 * does. This lets an admin see a believable dashboard in the first minute,
 * clearly labelled as sample data and never written anywhere.
 *
 * The cast is built to show each state once: someone past a policy limit,
 * someone with an open stay heading for a threshold, someone clear, someone
 * whose record has gone stale and someone who has logged nothing. Dates are
 * relative to today so it never looks old.
 */
import { fromDayIndex, toDayIndex } from "@/lib/schengen";
import type { MemberRef, OrgPolicy, PresenceRow } from "./presence";

export type SampleRequest = {
  id: string;
  org_id: string;
  user_id: string;
  country_code: string;
  start_date: string;
  end_date: string;
  status: "pending";
  decided_by: null;
  decided_at: null;
  note: string;
  created_at: string;
};

export type SampleDashboard = {
  rows: PresenceRow[];
  members: MemberRef[];
  policies: OrgPolicy[];
  requests: SampleRequest[];
};

export function sampleDashboard(todayIso: string): SampleDashboard {
  const t = toDayIndex(todayIso);
  const day = (offset: number) => fromDayIndex(t + offset);
  const stamp = (offset: number) => `${day(offset)}T09:00:00Z`;

  const person = (
    id: string,
    display_name: string,
    status: MemberRef["status"] = "active",
  ): MemberRef => ({
    user_id: id,
    member_id: `sample-${id}`,
    display_name,
    invite_email: null,
    role: "member",
    status,
    joined_at: stamp(-200),
  });

  return {
    members: [
      person("s1", "Amina Okafor"),
      person("s2", "Jonas Weber"),
      person("s3", "Priya Raman"),
      person("s4", "Mateo Silva"),
      person("s5", "Elin Nyberg"),
      {
        ...person("s6", ""),
        user_id: null,
        invite_email: "noor@example.com",
        status: "invited",
        joined_at: null,
      },
    ],
    rows: [
      // Open stay heading for the 183-day line.
      {
        user_id: "s1",
        country_code: "DE",
        entry_date: day(-165),
        exit_date: null,
        logged_at: stamp(-165),
      },
      // Past the 30-day policy limit in Spain.
      {
        user_id: "s2",
        country_code: "ES",
        entry_date: day(-70),
        exit_date: day(-30),
        logged_at: stamp(-29),
      },
      // Tidy, recent, comfortably inside every limit.
      {
        user_id: "s3",
        country_code: "FR",
        entry_date: day(-120),
        exit_date: day(-100),
        logged_at: stamp(-99),
      },
      {
        user_id: "s3",
        country_code: "PT",
        entry_date: day(-20),
        exit_date: day(-5),
        logged_at: stamp(-4),
      },
      // Open stay that was never closed.
      {
        user_id: "s4",
        country_code: "IT",
        entry_date: day(-95),
        exit_date: null,
        logged_at: stamp(-95),
      },
    ],
    policies: [
      {
        id: "sample-p1",
        country_code: "ES",
        max_days: 30,
        requires_approval: true,
        note: "Sample policy",
      },
    ],
    requests: [
      {
        id: "sample-r1",
        org_id: "sample",
        user_id: "s3",
        country_code: "DE",
        start_date: day(10),
        end_date: day(20),
        status: "pending",
        decided_by: null,
        decided_at: null,
        note: "Client workshop",
        created_at: stamp(-1),
      },
    ],
  };
}
