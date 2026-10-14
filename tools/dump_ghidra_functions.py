# Ghidra headless post-script: write executable function ranges as JSON.
import json

output = askFile("Function range output", "Save")
ranges = []
for function in currentProgram.getFunctionManager().getFunctions(True):
    body = function.getBody()
    ranges.append([function.getEntryPoint().getOffset(), body.getMaxAddress().getOffset() - function.getEntryPoint().getOffset() + 1])
with open(output.getAbsolutePath(), "w") as stream:
    json.dump(ranges, stream)

