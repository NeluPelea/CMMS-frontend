using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPeopleRolesAssignmentsCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                table: "People",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "People",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "People",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "People",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                table: "People",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "People",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Specialization",
                table: "People",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "AssignmentRoles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CompanyBlackoutDays",
                columns: table => new
                {
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanyBlackoutDays", x => x.Date);
                });

            migrationBuilder.CreateTable(
                name: "NationalHolidays",
                columns: table => new
                {
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NationalHolidays", x => x.Date);
                });

            migrationBuilder.CreateTable(
                name: "PersonLeaves",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonLeaves", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PersonLeaves_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PersonWorkSchedules",
                columns: table => new
                {
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    MonFriStart = table.Column<TimeSpan>(type: "interval", nullable: false),
                    MonFriEnd = table.Column<TimeSpan>(type: "interval", nullable: false),
                    SatStart = table.Column<TimeSpan>(type: "interval", nullable: true),
                    SatEnd = table.Column<TimeSpan>(type: "interval", nullable: true),
                    Timezone = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonWorkSchedules", x => x.PersonId);
                    table.ForeignKey(
                        name: "FK_PersonWorkSchedules_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PmPlanAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PmPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PmPlanAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PmPlanAssignments_AssignmentRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AssignmentRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PmPlanAssignments_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PmPlanAssignments_PmPlans_PmPlanId",
                        column: x => x.PmPlanId,
                        principalTable: "PmPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlannedFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    PlannedTo = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrderAssignments_AssignmentRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AssignmentRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkOrderAssignments_People_PersonId",
                        column: x => x.PersonId,
                        principalTable: "People",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkOrderAssignments_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentRoles_Name",
                table: "AssignmentRoles",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PersonLeaves_PersonId_StartDate_EndDate",
                table: "PersonLeaves",
                columns: new[] { "PersonId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_PmPlanAssignments_PersonId",
                table: "PmPlanAssignments",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_PmPlanAssignments_PmPlanId_PersonId_RoleId",
                table: "PmPlanAssignments",
                columns: new[] { "PmPlanId", "PersonId", "RoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PmPlanAssignments_RoleId",
                table: "PmPlanAssignments",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAssignments_PersonId",
                table: "WorkOrderAssignments",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAssignments_RoleId",
                table: "WorkOrderAssignments",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAssignments_WorkOrderId_PersonId",
                table: "WorkOrderAssignments",
                columns: new[] { "WorkOrderId", "PersonId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderAssignments_WorkOrderId_PersonId_RoleId",
                table: "WorkOrderAssignments",
                columns: new[] { "WorkOrderId", "PersonId", "RoleId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompanyBlackoutDays");

            migrationBuilder.DropTable(
                name: "NationalHolidays");

            migrationBuilder.DropTable(
                name: "PersonLeaves");

            migrationBuilder.DropTable(
                name: "PersonWorkSchedules");

            migrationBuilder.DropTable(
                name: "PmPlanAssignments");

            migrationBuilder.DropTable(
                name: "WorkOrderAssignments");

            migrationBuilder.DropTable(
                name: "AssignmentRoles");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "People");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "People");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "People");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                table: "People");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "People");

            migrationBuilder.DropColumn(
                name: "Specialization",
                table: "People");

            migrationBuilder.AlterColumn<string>(
                name: "DisplayName",
                table: "People",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);
        }
    }
}
