using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cmms.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StrictPartDeactivation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
             migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION check_part_deactivation() RETURNS TRIGGER AS $$
DECLARE
    stock_qty numeric;
    has_consumption boolean;
BEGIN
    -- Only check when deactivating (true -> false)
    IF OLD.""IsAct"" = true AND NEW.""IsAct"" = false THEN
        
        -- Check 1: Stock > 0
        SELECT COALESCE(SUM(""QtyOnHand""), 0) INTO stock_qty
        FROM ""Inventory""
        WHERE ""PartId"" = NEW.""Id"";
        
        IF stock_qty > 0 THEN
            RAISE EXCEPTION 'Nu poti inactiva piesa: exista stoc (Qty=%)', stock_qty;
        END IF;

        -- Check 2: Has Consumption
        SELECT EXISTS (
            SELECT 1 FROM ""WorkOrderParts"" WHERE ""PartId"" = NEW.""Id""
        ) INTO has_consumption;
        
        IF has_consumption THEN
            RAISE EXCEPTION 'Nu poti inactiva piesa: exista consum in istoric.';
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_part_deactivation
BEFORE UPDATE ON ""Parts""
FOR EACH ROW
EXECUTE FUNCTION check_part_deactivation();
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS trg_check_part_deactivation ON ""Parts"";
DROP FUNCTION IF EXISTS check_part_deactivation();
            ");
        }
    }
}
