using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class WorkOrderEventsAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "work_order_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ActorId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Field = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    OldValue = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    NewValue = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CorrelationId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_order_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_work_order_events_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_work_order_events_CreatedAtUtc",
                table: "work_order_events",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_work_order_events_WorkOrderId_CreatedAtUtc",
                table: "work_order_events",
                columns: new[] { "WorkOrderId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "work_order_events");
        }
    }
}
