<?php require_once '../modules.php'; ?>
<!DOCTYPE html>
<html>
<head>
	<title>CommonJS.php test</title>
	<style>
		html, body { margin:0; padding:0; }
		.report { background:blue; color:white; padding:5px; text-indent:5px; cursor:pointer; }
		.pass { background:green; }
		.fail { background:red; }
		.report ol { display:none; }
		.report:hover ol, .report:focus ol { display:block; }
	</style>
	<?php Modules::script(); ?>
</head>
<body>
	<div class="report">CommonJS.php tests</div>
	<script>require('test/cases');</script>
</body>
</html>