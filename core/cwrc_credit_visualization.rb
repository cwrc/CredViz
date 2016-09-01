require 'pathname'
require 'active_support'

# require 'procrastinator'

# require 'mail' # TODO: remove dependency on email face
# require 'erb'
# require 'tilt'
# require 'nokogiri'
# require 'ghostwriter'

module Dirt
   PROJECT_ROOT = Pathname.new(File.dirname(__FILE__) + '/..').realpath
end

# TODO: extract to a gem, and TDD it
class MissingEnv < StandardError
end

def expect_env(key)
   prefix = 'app_'

   key    = prefix + key unless key.start_with?(prefix)

   value = ENV[key]

   unless value
      $stderr.puts "WARNING: Missing expected ENV variable #{key}. Program may fail if running in full operation."
   end
end

def require_env(key)
   prefix = 'app_'

   key    = prefix + key unless key.start_with?(prefix)

   value = ENV[key]

   unless value
      app_vars = ENV.select do |k, v|
         k.start_with? prefix
      end

      raise MissingEnv.new("You must provide app environment variable '#{key}'. Variables provided: #{app_vars}")
   end

   value = ENV[key]
end

# require_env 'db_user'
# require_env 'db_name'
# expect_env 'db_host'
# expect_env 'db_password'

module Riverwind
   app_dir = Pathname.new(__FILE__).dirname

   # require ALL the files!
   Dir["#{app_dir}/**/*.rb"].reject { |f| f.include?('/tests/') }.each do |file|
      require file
   end

   UNITS_FILE_PATH = Pathname.new('data/units.csv')

   PHOTO_BYTE_LIMIT = 2 * 10**6 # 2 MB

   module Context
      # create stub context to get tests running
   end
end
