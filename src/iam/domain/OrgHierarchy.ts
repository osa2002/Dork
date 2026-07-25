export interface OrganizationNode {
  orgId: string;
  tenantId: string;
  name: string;
  domain: string;
  createdAtIso: string;
  departments: DepartmentNode[];
}

export interface DepartmentNode {
  departmentId: string;
  orgId: string;
  name: string;
  costCenterCode?: string;
  headUserId?: string;
  teams: TeamNode[];
}

export interface TeamNode {
  teamId: string;
  departmentId: string;
  name: string;
  leadUserId?: string;
  groups: GroupNode[];
}

export interface GroupNode {
  groupId: string;
  teamId: string;
  name: string;
  assignedRoleIds: string[];
  memberUserIds: string[];
}

export interface UserRoleBinding {
  bindingId: string;
  tenantId: string;
  userId: string;
  roleId: string;
  scopeType: "ORGANIZATION" | "DEPARTMENT" | "TEAM" | "GROUP";
  scopeId: string; // orgId, departmentId, teamId, or groupId
  grantedAtIso: string;
  grantedByUserId: string;
}

export class OrgHierarchyAggregate {
  public static createOrganization(tenantId: string, name: string, domain: string): OrganizationNode {
    return {
      orgId: `org_${tenantId}_${Date.now()}`,
      tenantId,
      name,
      domain,
      createdAtIso: new Date().toISOString(),
      departments: []
    };
  }

  public static addDepartment(org: OrganizationNode, name: string, costCenterCode?: string): DepartmentNode {
    const dept: DepartmentNode = {
      departmentId: `dept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orgId: org.orgId,
      name,
      costCenterCode,
      teams: []
    };
    org.departments.push(dept);
    return dept;
  }

  public static addTeam(dept: DepartmentNode, name: string, leadUserId?: string): TeamNode {
    const team: TeamNode = {
      teamId: `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      departmentId: dept.departmentId,
      name,
      leadUserId,
      groups: []
    };
    dept.teams.push(team);
    return team;
  }

  public static addGroup(team: TeamNode, name: string, assignedRoleIds: string[] = []): GroupNode {
    const group: GroupNode = {
      groupId: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      teamId: team.teamId,
      name,
      assignedRoleIds,
      memberUserIds: []
    };
    team.groups.push(group);
    return group;
  }
}
