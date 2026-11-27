import subprocess, json

# Read all from Declarations
read_res = subprocess.run(
    'gsheets readonly read 1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs "Declarations!A1:W36" --json',
    shell=True,
    capture_output=True,
    text=True,
)
data = json.loads(read_res.stdout)
rows = data if isinstance(data, list) else data.get("values", [])
print(f"Read {len(rows)} rows from Declarations.")

# Write to Archive_Test_Pilote
batch_file = r"C:\Users\Digi Face\.gemini\antigravity\brain\db2533f0-742a-4efc-8e00-648252483692\scratch\archive_batch.json"
with open(batch_file, "w", encoding="utf-8") as f:
    json.dump({"data": [{"range": f"Archive_Test_Pilote!A1:W{len(rows)}", "values": rows}]}, f)

sub_res = subprocess.run(
    f'gsheets mutate batch 1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs -f "{batch_file}"',
    shell=True,
    capture_output=True,
    text=True,
)
print("Archive write result:", sub_res.stdout, sub_res.stderr)

# Now clear Declarations from row 2 downwards
clear_res = subprocess.run(
    'gsheets mutate clear 1PVRpET7yYune0RlTYf6YBOw2IfFEP-DU5dsDqEAo5Rs "Declarations!A2:W100"',
    shell=True,
    capture_output=True,
    text=True,
)
print("Clear Declarations result:", clear_res.stdout, clear_res.stderr)
