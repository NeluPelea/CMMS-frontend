using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitFull : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_assets_locations_LocationId",
                table: "assets");

            migrationBuilder.DropForeignKey(
                name: "FK_work_orders_assets_AssetId",
                table: "work_orders");

            migrationBuilder.DropForeignKey(
                name: "FK_work_orders_people_AssignedToPersonId",
                table: "work_orders");

            migrationBuilder.DropTable(
                name: "role_claims");

            migrationBuilder.DropTable(
                name: "user_claims");

            migrationBuilder.DropTable(
                name: "user_logins");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "user_tokens");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropPrimaryKey(
                name: "PK_people",
                table: "people");

            migrationBuilder.DropPrimaryKey(
                name: "PK_locations",
                table: "locations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_assets",
                table: "assets");

            migrationBuilder.DropPrimaryKey(
                name: "PK_work_orders",
                table: "work_orders");

            migrationBuilder.RenameTable(
                name: "people",
                newName: "People");

            migrationBuilder.RenameTable(
                name: "locations",
                newName: "Locations");

            migrationBuilder.RenameTable(
                name: "assets",
                newName: "Assets");

            migrationBuilder.RenameTable(
                name: "work_orders",
                newName: "WorkOrders");

            migrationBuilder.RenameIndex(
                name: "IX_assets_LocationId",
                table: "Assets",
                newName: "IX_Assets_LocationId");

            migrationBuilder.RenameIndex(
                name: "IX_work_orders_AssignedToPersonId",
                table: "WorkOrders",
                newName: "IX_WorkOrders_AssignedToPersonId");

            migrationBuilder.RenameIndex(
                name: "IX_work_orders_AssetId",
                table: "WorkOrders",
                newName: "IX_WorkOrders_AssetId");

            migrationBuilder.AlterColumn<bool>(
                name: "IsAct",
                table: "Locations",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: true);

            migrationBuilder.AlterColumn<bool>(
                name: "IsAct",
                table: "Assets",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_People",
                table: "People",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Locations",
                table: "Locations",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Assets",
                table: "Assets",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_WorkOrders",
                table: "WorkOrders",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "Parts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: true),
                    Uom = table.Column<string>(type: "text", nullable: true),
                    IsAct = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PmPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Frequency = table.Column<int>(type: "integer", nullable: false),
                    NextDueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsAct = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PmPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PmPlans_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Inventory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PartId = table.Column<Guid>(type: "uuid", nullable: false),
                    QtyOnHand = table.Column<decimal>(type: "numeric", nullable: false),
                    MinQty = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Inventory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Inventory_Parts_PartId",
                        column: x => x.PartId,
                        principalTable: "Parts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkOrderParts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartId = table.Column<Guid>(type: "uuid", nullable: false),
                    QtyUsed = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkOrderParts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkOrderParts_Parts_PartId",
                        column: x => x.PartId,
                        principalTable: "Parts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkOrderParts_WorkOrders_WorkOrderId",
                        column: x => x.WorkOrderId,
                        principalTable: "WorkOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PmPlanItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PmPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false),
                    Sort = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PmPlanItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PmPlanItems_PmPlans_PmPlanId",
                        column: x => x.PmPlanId,
                        principalTable: "PmPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Locations_Name",
                table: "Locations",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_Name",
                table: "Assets",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Inventory_PartId",
                table: "Inventory",
                column: "PartId");

            migrationBuilder.CreateIndex(
                name: "IX_PmPlanItems_PmPlanId",
                table: "PmPlanItems",
                column: "PmPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_PmPlans_AssetId",
                table: "PmPlans",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderParts_PartId",
                table: "WorkOrderParts",
                column: "PartId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkOrderParts_WorkOrderId_PartId",
                table: "WorkOrderParts",
                columns: new[] { "WorkOrderId", "PartId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Assets_Locations_LocationId",
                table: "Assets",
                column: "LocationId",
                principalTable: "Locations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrders_Assets_AssetId",
                table: "WorkOrders",
                column: "AssetId",
                principalTable: "Assets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkOrders_People_AssignedToPersonId",
                table: "WorkOrders",
                column: "AssignedToPersonId",
                principalTable: "People",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assets_Locations_LocationId",
                table: "Assets");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrders_Assets_AssetId",
                table: "WorkOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkOrders_People_AssignedToPersonId",
                table: "WorkOrders");

            migrationBuilder.DropTable(
                name: "Inventory");

            migrationBuilder.DropTable(
                name: "PmPlanItems");

            migrationBuilder.DropTable(
                name: "WorkOrderParts");

            migrationBuilder.DropTable(
                name: "PmPlans");

            migrationBuilder.DropTable(
                name: "Parts");

            migrationBuilder.DropPrimaryKey(
                name: "PK_People",
                table: "People");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Locations",
                table: "Locations");

            migrationBuilder.DropIndex(
                name: "IX_Locations_Name",
                table: "Locations");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Assets",
                table: "Assets");

            migrationBuilder.DropIndex(
                name: "IX_Assets_Name",
                table: "Assets");

            migrationBuilder.DropPrimaryKey(
                name: "PK_WorkOrders",
                table: "WorkOrders");

            migrationBuilder.RenameTable(
                name: "People",
                newName: "people");

            migrationBuilder.RenameTable(
                name: "Locations",
                newName: "locations");

            migrationBuilder.RenameTable(
                name: "Assets",
                newName: "assets");

            migrationBuilder.RenameTable(
                name: "WorkOrders",
                newName: "work_orders");

            migrationBuilder.RenameIndex(
                name: "IX_Assets_LocationId",
                table: "assets",
                newName: "IX_assets_LocationId");

            migrationBuilder.RenameIndex(
                name: "IX_WorkOrders_AssignedToPersonId",
                table: "work_orders",
                newName: "IX_work_orders_AssignedToPersonId");

            migrationBuilder.RenameIndex(
                name: "IX_WorkOrders_AssetId",
                table: "work_orders",
                newName: "IX_work_orders_AssetId");

            migrationBuilder.AlterColumn<bool>(
                name: "IsAct",
                table: "locations",
                type: "boolean",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AlterColumn<bool>(
                name: "IsAct",
                table: "assets",
                type: "boolean",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AddPrimaryKey(
                name: "PK_people",
                table: "people",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_locations",
                table: "locations",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_assets",
                table: "assets",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_work_orders",
                table: "work_orders",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "role_claims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_claims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_role_claims_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_claims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_claims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_claims_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_logins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_logins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_user_logins_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_user_roles_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_roles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_tokens",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_tokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_user_tokens_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_role_claims_RoleId",
                table: "role_claims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "roles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_claims_UserId",
                table: "user_claims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_logins_UserId",
                table: "user_logins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_RoleId",
                table: "user_roles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "users",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "users",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_assets_locations_LocationId",
                table: "assets",
                column: "LocationId",
                principalTable: "locations",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_work_orders_assets_AssetId",
                table: "work_orders",
                column: "AssetId",
                principalTable: "assets",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_work_orders_people_AssignedToPersonId",
                table: "work_orders",
                column: "AssignedToPersonId",
                principalTable: "people",
                principalColumn: "Id");
        }
    }
}
