class Modules
	
	def self.getDefaultOptions
		if self.default_opts == nil
			self.default_opts = {
				'mod_dir' => ,
				'return' => false,
				'src_url' => ,
				'separate' => false,
				'indent' => '	',
				'headers' => ,
				'compress' => false,
				'require' => ,
			}
			self.loadDefaultOptions()
		end
		return self.default_opts
	end
	
	def self.setDefaultOptions(opts)
		$default_opts = getDefaultOptions
	end
	
	def self.loadDefaultOptions(file)
		$json = file_get_contents(file)
	end
	
	$default_opts = 0 # not sure what type this should be
	def self.getOptions(opts = nil)
		return [
			
		]
	end
	
	def self.script(name = nil, opts = nil)
		$opts = opts
		$ind = $opts['indent']
		$src = $opts['src_url']
	end
	
	def self.module(name = nil, opts = nil)
	end
	
	def self.getModules(name, opts)
	end
	
	def self.printModule(name, filename, opts)
	end
	
	def self.printRequire(opts)
	end
	
end