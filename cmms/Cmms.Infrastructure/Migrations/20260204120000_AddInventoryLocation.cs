using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    public partial class AddInventoryLocation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // add nullable LocationId to Inventory
            migrationBuilder.AddColumn<Guid>(
                name: "LocationId",
                table: "Inventory",
                type: "uuid",
                nullable: true);

            // create composite index for (PartId, LocationId)
            migrationBuilder.CreateIndex(
                name: "IX_Inventory_PartId_LocationId",
                table: "Inventory",
                columns: new[] { "PartId", "LocationId" });

            // add FK to Locations (nullable, on delete set null)
            migrationBuilder.AddForeignKey(
                name: "FK_Inventory_Locations_LocationId",
                table: "Inventory",
                column: "LocationId",
                principalTable: "Locations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Inventory_Locations_LocationId",
                table: "Inventory");

            migrationBuilder.DropIndex(
                name: "IX_Inventory_PartId_LocationId",
                table: "Inventory");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "Inventory");
        }
    }
}