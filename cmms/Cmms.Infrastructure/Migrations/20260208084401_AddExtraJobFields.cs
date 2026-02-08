using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraJobFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartAt",
                table: "ExtraJobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "ExtraJobs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StopAt",
                table: "ExtraJobs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "extra_job_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExtraJobId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ActorId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Field = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    OldValue = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    NewValue = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_extra_job_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_extra_job_events_ExtraJobs_ExtraJobId",
                        column: x => x.ExtraJobId,
                        principalTable: "ExtraJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_extra_job_events_CreatedAtUtc",
                table: "extra_job_events",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_extra_job_events_ExtraJobId",
                table: "extra_job_events",
                column: "ExtraJobId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "extra_job_events");

            migrationBuilder.DropColumn(
                name: "StartAt",
                table: "ExtraJobs");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "ExtraJobs");

            migrationBuilder.DropColumn(
                name: "StopAt",
                table: "ExtraJobs");
        }
    }
}
