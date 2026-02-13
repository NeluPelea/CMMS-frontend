using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PmSchedulingUpgrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ScheduledForUtc",
                table: "WorkOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "pm_plan_execution_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PmPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    ScheduledForUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    GeneratedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    TriggeredBy = table.Column<string>(type: "text", nullable: false),
                    Result = table.Column<string>(type: "text", nullable: false),
                    Error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pm_plan_execution_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_pm_plan_execution_logs_PmPlans_PmPlanId",
                        column: x => x.PmPlanId,
                        principalTable: "PmPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_pm_plan_execution_logs_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 12, 18, 0, 25, 315, DateTimeKind.Unspecified).AddTicks(1452), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 12, 18, 0, 25, 315, DateTimeKind.Unspecified).AddTicks(1453), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 12, 18, 0, 25, 315, DateTimeKind.Unspecified).AddTicks(1446), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrders_PmPlanId_ScheduledForUtc",
                table: "WorkOrders",
                columns: new[] { "PmPlanId", "ScheduledForUtc" },
                unique: true,
                filter: "\"PmPlanId\" IS NOT NULL AND \"ScheduledForUtc\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_execution_logs_PmPlanId",
                table: "pm_plan_execution_logs",
                column: "PmPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_execution_logs_ScheduledForUtc",
                table: "pm_plan_execution_logs",
                column: "ScheduledForUtc");

            migrationBuilder.CreateIndex(
                name: "IX_pm_plan_execution_logs_WorkOrderId",
                table: "pm_plan_execution_logs",
                column: "WorkOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pm_plan_execution_logs");

            migrationBuilder.DropIndex(
                name: "IX_WorkOrders_PmPlanId_ScheduledForUtc",
                table: "WorkOrders");

            migrationBuilder.DropColumn(
                name: "ScheduledForUtc",
                table: "WorkOrders");

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_EUR",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 11, 21, 23, 10, 106, DateTimeKind.Unspecified).AddTicks(697), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "FX_RON_USD",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 11, 21, 23, 10, 106, DateTimeKind.Unspecified).AddTicks(699), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "app_settings",
                keyColumn: "Key",
                keyValue: "VAT_RATE",
                column: "UpdatedAt",
                value: new DateTimeOffset(new DateTime(2026, 2, 11, 21, 23, 10, 106, DateTimeKind.Unspecified).AddTicks(688), new TimeSpan(0, 0, 0, 0, 0)));
        }
    }
}
