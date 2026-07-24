import { IncidentSeverityLevel } from "./IncidentSeverity";

export interface CommanderProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly title: string;
  readonly team: string;
  readonly pagerId: string;
}

export interface CommanderStaffing {
  readonly primaryCommander: CommanderProfile;
  readonly communicationsLead: CommanderProfile;
  readonly operationsLead: CommanderProfile;
  readonly deputyCommander?: CommanderProfile;
  readonly warRoomUrl: string;
  readonly slackChannel: string;
}

export class IncidentCommander {
  // SRE Command Roster Database
  private static readonly ROSTER: readonly CommanderProfile[] = [
    {
      id: "cmd-1",
      name: "Alex Rivera",
      email: "arivera@enterprise.sre",
      title: "Principal SRE Architect",
      team: "Global Command Center",
      pagerId: "pager-9912",
    },
    {
      id: "cmd-2",
      name: "Yuki Tanaka",
      email: "ytanaka@enterprise.sre",
      title: "Senior Incident Commander",
      team: "Site Reliability Engineering",
      pagerId: "pager-4552",
    },
    {
      id: "cmd-3",
      name: "Marcus Vance",
      email: "mvance@enterprise.sre",
      title: "VP of Technical Operations",
      team: "Infrastructure Services",
      pagerId: "pager-0010",
    },
    {
      id: "cmd-4",
      name: "Elena Rostova",
      email: "erostova@enterprise.sre",
      title: "Lead SRE Engineer",
      team: "Platform Foundations",
      pagerId: "pager-8821",
    },
    {
      id: "cmd-5",
      name: "Samir Patel",
      email: "spatel@enterprise.sre",
      title: "Operations Center Lead",
      team: "Command & Control",
      pagerId: "pager-1123",
    },
  ];

  /**
   * Statelessly assigns the incident response crew based on severity level.
   */
  public static staff(severity: IncidentSeverityLevel, incidentId: string): CommanderStaffing {
    const warRoomId = incidentId.replace("inc-", "");
    const warRoomUrl = `https://meet.enterprise.internal/war-room-${warRoomId}`;
    const slackChannel = `#incident-${warRoomId}`;

    if (severity === "SEV1") {
      return Object.freeze({
        primaryCommander: this.ROSTER[2], // Marcus Vance (VP Tech Ops)
        communicationsLead: this.ROSTER[1], // Yuki Tanaka
        operationsLead: this.ROSTER[0], // Alex Rivera
        deputyCommander: this.ROSTER[4], // Samir Patel
        warRoomUrl,
        slackChannel,
      });
    }

    if (severity === "SEV2") {
      return Object.freeze({
        primaryCommander: this.ROSTER[0], // Alex Rivera
        communicationsLead: this.ROSTER[4], // Samir Patel
        operationsLead: this.ROSTER[3], // Elena Rostova
        deputyCommander: this.ROSTER[1], // Yuki Tanaka
        warRoomUrl,
        slackChannel,
      });
    }

    // SEV3/4: Lightweight Staffing
    return Object.freeze({
      primaryCommander: this.ROSTER[3], // Elena Rostova
      communicationsLead: this.ROSTER[4], // Samir Patel
      operationsLead: this.ROSTER[1], // Yuki Tanaka
      warRoomUrl,
      slackChannel,
    });
  }
}
